const { withGradleProperties } = require("expo/config-plugins");

/**
 * Windows MAX_PATH (~260). Expo's default CMAKE_OBJECT_PATH_MAX=1024 disables
 * CMake's hashing, so Reanimated writes object files like
 * CMakeFiles/reanimated.dir/C_/Users/.../CSS/common/transforms (~286 chars).
 * Ninja then fails mkdir unless Windows long paths are enabled.
 *
 * 250 is CMake's Windows default: the object dir (~151 chars) stays unhashed,
 * only the over-long source paths get short hashes. Keep CMake 3.31.6 too.
 */
function upsertProperty(items, key, value) {
  const next = items.filter(
    (item) => !(item.type === "property" && item.key === key),
  );
  next.push({ type: "property", key, value });
  return next;
}

module.exports = function withCmakeObjectPathMax(config) {
  return withGradleProperties(config, (gradleConfig) => {
    // EAS Linux images do not ship CMake 3.31.6 (CXX1300). Pin only on
    // Windows, where that version is what keeps Ninja under MAX_PATH.
    if (process.platform === "win32") {
      gradleConfig.modResults = upsertProperty(
        gradleConfig.modResults,
        "android.cmakeVersion",
        "3.31.6",
      );
    } else {
      gradleConfig.modResults = gradleConfig.modResults.filter(
        (item) =>
          !(item.type === "property" && item.key === "android.cmakeVersion"),
      );
    }
    gradleConfig.modResults = upsertProperty(
      gradleConfig.modResults,
      "expo.android.cmakeObjectPathMax",
      "250",
    );
    return gradleConfig;
  });
};
