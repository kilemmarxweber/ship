const fs = require("fs");
const path = require("path");
const {
  AndroidConfig,
  withDangerousMod,
  withAndroidManifest,
} = require("expo/config-plugins");

const WEBRTC_JAVA =
  "node_modules/@livekit/react-native-webrtc/android/src/main/java/com/oney/WebRTCModule";

const PATCH_FILES = [
  "MediaProjectionNotification.java",
  "MediaProjectionService.java",
  "ScreenShareKeepAliveService.java",
];

function copyNativePatch(projectRoot) {
  const srcDir = path.join(projectRoot, "plugins", "native");
  const destDir = path.join(projectRoot, WEBRTC_JAVA);
  if (!fs.existsSync(destDir)) return;
  for (const file of PATCH_FILES) {
    const from = path.join(srcDir, file);
    const to = path.join(destDir, file);
    if (!fs.existsSync(from)) continue;
    fs.copyFileSync(from, to);
  }
  patchGetUserMediaImpl(destDir);
  patchScreenCaptureController(destDir);
}

function patchGetUserMediaImpl(destDir) {
  const file = path.join(destDir, "GetUserMediaImpl.java");
  if (!fs.existsSync(file)) return;
  let src = fs.readFileSync(file, "utf8");
  if (!src.includes("ScreenShareKeepAliveService.launch")) {
    src = src.replace(
      `if (mediaProjectionManager != null) {
            UiThreadUtil.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    currentActivity.startActivityForResult(
                            mediaProjectionManager.createScreenCaptureIntent(), PERMISSION_REQUEST_CODE);
                }
            });`,
      `if (mediaProjectionManager != null) {
            // Keep RN alive while the system share sheet is open (prevents app kill).
            ScreenShareKeepAliveService.launch(currentActivity.getApplicationContext());
            UiThreadUtil.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    currentActivity.startActivityForResult(
                            mediaProjectionManager.createScreenCaptureIntent(), PERMISSION_REQUEST_CODE);
                }
            });`,
    );
  }
  if (!src.includes("ScreenShareKeepAliveService.abort(activity)")) {
    src = src.replace(
      `if (resultCode != Activity.RESULT_OK) {
                        displayMediaPromise.reject("DOMException", "NotAllowedError");
                        displayMediaPromise = null;
                        return;
                    }`,
      `if (resultCode != Activity.RESULT_OK) {
                        ScreenShareKeepAliveService.abort(activity);
                        displayMediaPromise.reject("DOMException", "NotAllowedError");
                        displayMediaPromise = null;
                        return;
                    }`,
    );
  }
  // Keep ScreenShareKeepAliveService running for the whole share session so
  // Android does not kill the RN process when the host leaves the app.
  if (
    src.includes(
      "ScreenShareKeepAliveService.abort(activity);\n                        createScreenStream",
    )
  ) {
    src = src.replace(
      `ThreadUtils.runOnExecutor(() -> {
                        MediaProjectionService.launch(activity);
                        ScreenShareKeepAliveService.abort(activity);
                        createScreenStream();
                    });`,
      `ThreadUtils.runOnExecutor(() -> {
                        MediaProjectionService.launch(activity);
                        // Keep-alive stays up with MediaProjection FGS (Meet-like).
                        createScreenStream();
                    });`,
    );
  } else if (
    !src.includes(
      "MediaProjectionService.launch(activity);\n                        // Keep-alive stays up",
    )
  ) {
    src = src.replace(
      `ThreadUtils.runOnExecutor(() -> {
                        MediaProjectionService.launch(activity);
                        createScreenStream();
                    });`,
      `ThreadUtils.runOnExecutor(() -> {
                        MediaProjectionService.launch(activity);
                        // Keep-alive stays up with MediaProjection FGS (Meet-like).
                        createScreenStream();
                    });`,
    );
  }
  fs.writeFileSync(file, src);
}

function patchScreenCaptureController(destDir) {
  const file = path.join(destDir, "ScreenCaptureController.java");
  if (!fs.existsSync(file)) return;
  let src = fs.readFileSync(file, "utf8");
  if (src.includes("ScreenShareKeepAliveService.abort")) {
    fs.writeFileSync(file, src);
    return;
  }
  src = src.replace(
    `MediaProjectionService.abort(context);
        super.dispose();`,
    `MediaProjectionService.abort(context);
        ScreenShareKeepAliveService.abort(context);
        super.dispose();`,
  );
  fs.writeFileSync(file, src);
}

function ensureNotificationIcon(projectRoot) {
  const drawable = path.join(
    projectRoot,
    "android",
    "app",
    "src",
    "main",
    "res",
    "drawable",
  );
  if (!fs.existsSync(drawable)) fs.mkdirSync(drawable, { recursive: true });
  const iconPath = path.join(drawable, "ic_notification.xml");
  const body = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M4,4h12c1.1,0 2,0.9 2,2v8c0,1.1 -0.9,2 -2,2h-4l-1,2h-2l-1,-2H4c-1.1,0 -2,-0.9 -2,-2V6c0,-1.1 0.9,-2 2,-2zM4,6v8h12V6H4zM18.5,9.5l3.5,-2v9l-3.5,-2v-5z" />
</vector>
`;
  fs.writeFileSync(iconPath, body);
}

function ensureService(manifest, name, foregroundServiceType) {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  const services = app.service ?? [];
  const existing = services.find((row) => row?.$?.["android:name"] === name);
  const attrs = {
    "android:name": name,
    "android:exported": "false",
    "android:foregroundServiceType": foregroundServiceType,
    "android:stopWithTask": "false",
    "tools:node": "merge",
  };
  if (existing) Object.assign(existing.$, attrs);
  else services.push({ $: attrs });
  app.service = services;
}

function forceUpdatesNeverOnLaunch(manifest) {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  const meta = app["meta-data"] ?? [];
  let found = false;
  for (const row of meta) {
    if (
      row?.$?.["android:name"] ===
      "expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH"
    ) {
      row.$["android:value"] = "NEVER";
      row.$["tools:replace"] = "android:value";
      found = true;
    }
  }
  if (!found) {
    meta.push({
      $: {
        "android:name": "expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH",
        "android:value": "NEVER",
        "tools:replace": "android:value",
      },
    });
  }
  app["meta-data"] = meta;
}

/**
 * Meet / WhatsApp screen-share keep-alive + no OTA wipe on launch.
 */
module.exports = function withScreenShareKeepAlive(config) {
  config = withDangerousMod(config, [
    "android",
    async (mod) => {
      copyNativePatch(mod.modRequest.projectRoot);
      ensureNotificationIcon(mod.modRequest.projectRoot);
      return mod;
    },
  ]);

  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    ensureService(
      manifest,
      "com.oney.WebRTCModule.MediaProjectionService",
      "mediaProjection",
    );
    ensureService(
      manifest,
      "com.oney.WebRTCModule.ScreenShareKeepAliveService",
      "camera|microphone|mediaPlayback",
    );
    forceUpdatesNeverOnLaunch(manifest);
    const root = manifest.manifest.$ ?? {};
    if (!root["xmlns:tools"]) {
      root["xmlns:tools"] = "http://schemas.android.com/tools";
      manifest.manifest.$ = root;
    }
    return mod;
  });

  // Patch webrtc sources in node_modules only — never mkdir android/
  // during config eval (that makes prebuild "reuse" a hollow tree).
  try {
    copyNativePatch(process.cwd());
  } catch {
    /* ignore */
  }

  return config;
};
