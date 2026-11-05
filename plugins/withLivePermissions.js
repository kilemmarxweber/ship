const {
  AndroidConfig,
  withAndroidManifest,
} = require("expo/config-plugins");

const NEEDED = [
  "android.permission.CAMERA",
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_CAMERA",
  "android.permission.FOREGROUND_SERVICE_MICROPHONE",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION",
];

function ensurePermission(manifest, name) {
  const list = manifest.manifest["uses-permission"] ?? [];
  const found = list.some((row) => row?.$?.["android:name"] === name);
  if (!found) list.push({ $: { "android:name": name } });
  manifest.manifest["uses-permission"] = list;
}

function ensureMediaProjectionService(manifest) {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  const services = app.service ?? [];
  const name = "com.oney.WebRTCModule.MediaProjectionService";
  const existing = services.find((row) => row?.$?.["android:name"] === name);
  if (existing) {
    existing.$["android:foregroundServiceType"] = "mediaProjection";
    existing.$["android:exported"] = "false";
    existing.$["android:stopWithTask"] = "false";
    existing.$["tools:node"] = "merge";
  } else {
    services.push({
      $: {
        "android:name": name,
        "android:exported": "false",
        "android:foregroundServiceType": "mediaProjection",
        "android:stopWithTask": "false",
        "tools:node": "merge",
      },
    });
  }
  app.service = services;
  const root = manifest.manifest.$ ?? {};
  if (!root["xmlns:tools"]) {
    root["xmlns:tools"] = "http://schemas.android.com/tools";
    manifest.manifest.$ = root;
  }
}

module.exports = function withLivePermissions(config) {
  return withAndroidManifest(config, (mod) => {
    for (const name of NEEDED) ensurePermission(mod.modResults, name);
    ensureMediaProjectionService(mod.modResults);
    return mod;
  });
};
