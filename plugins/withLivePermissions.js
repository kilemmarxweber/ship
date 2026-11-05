const { withAndroidManifest } = require("expo/config-plugins");

const NEEDED = [
  "android.permission.CAMERA",
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION",
];

function ensurePermission(manifest, name) {
  const list = manifest.manifest["uses-permission"] ?? [];
  const found = list.some((row) => row?.$?.["android:name"] === name);
  if (!found) list.push({ $: { "android:name": name } });
  manifest.manifest["uses-permission"] = list;
}

module.exports = function withLivePermissions(config) {
  return withAndroidManifest(config, (mod) => {
    for (const name of NEEDED) ensurePermission(mod.modResults, name);
    return mod;
  });
};
