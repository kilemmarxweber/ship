const fs = require("fs");
const path = require("path");
const {
  AndroidConfig,
  withDangerousMod,
  withAndroidManifest,
} = require("expo/config-plugins");

const WEBRTC_JAVA =
  "node_modules/@livekit/react-native-webrtc/android/src/main/java/com/oney/WebRTCModule";

function copyNativePatch(projectRoot) {
  const srcDir = path.join(projectRoot, "plugins", "native");
  const destDir = path.join(projectRoot, WEBRTC_JAVA);
  for (const file of [
    "MediaProjectionNotification.java",
    "MediaProjectionService.java",
  ]) {
    const from = path.join(srcDir, file);
    const to = path.join(destDir, file);
    if (!fs.existsSync(from) || !fs.existsSync(destDir)) continue;
    fs.copyFileSync(from, to);
  }
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
  if (fs.existsSync(iconPath)) return;
  fs.writeFileSync(
    iconPath,
    `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M4,4h12c1.1,0 2,0.9 2,2v8c0,1.1 -0.9,2 -2,2h-4l-1,2h-2l-1,-2H4c-1.1,0 -2,-0.9 -2,-2V6c0,-1.1 0.9,-2 2,-2zM4,6v8h12V6H4zM18.5,9.5l3.5,-2v9l-3.5,-2v-5z" />
</vector>
`,
  );
}

function ensureMediaProjectionService(manifest) {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  const services = app.service ?? [];
  const name = "com.oney.WebRTCModule.MediaProjectionService";
  const existing = services.find((row) => row?.$?.["android:name"] === name);
  const attrs = {
    "android:name": name,
    "android:exported": "false",
    "android:foregroundServiceType": "mediaProjection",
    "android:stopWithTask": "false",
    "tools:node": "merge",
  };
  if (existing) Object.assign(existing.$, attrs);
  else services.push({ $: attrs });
  app.service = services;
  const root = manifest.manifest.$ ?? {};
  if (!root["xmlns:tools"]) {
    root["xmlns:tools"] = "http://schemas.android.com/tools";
    manifest.manifest.$ = root;
  }
}

/**
 * Meet / WhatsApp screen-share keep-alive:
 * - patches WebRTC MediaProjection FGS (sticky notif + wait-for-foreground)
 * - ensures ic_notification exists (missing icon = instant crash)
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
    ensureMediaProjectionService(mod.modResults);
    return mod;
  });

  // Also patch node_modules immediately when config is evaluated (dev rebuilds).
  try {
    const root = process.cwd();
    copyNativePatch(root);
    ensureNotificationIcon(root);
  } catch {
    /* ignore */
  }

  return config;
};
