const { withMainApplication } = require("expo/config-plugins");

/**
 * LiveKit must call LiveKitReactNative.setup() before React Native starts.
 * The Expo plugin's ApplicationLifecycleListener runs after loadReactNative,
 * so NativeModules.WebRTCModule stays null and @livekit/react-native-webrtc throws.
 */
module.exports = function withLiveKitAndroidSetup(config) {
  return withMainApplication(config, (mod) => {
    let src = mod.modResults.contents;
    if (src.includes("LiveKitReactNative.setup")) {
      return mod;
    }
    if (!src.includes("import com.livekit.reactnative.LiveKitReactNative")) {
      src = src.replace(
        "import expo.modules.ApplicationLifecycleDispatcher",
        "import com.livekit.reactnative.LiveKitReactNative\nimport expo.modules.ApplicationLifecycleDispatcher",
      );
    }
    src = src.replace(
      "super.onCreate()",
      "super.onCreate()\n    LiveKitReactNative.setup(this)",
    );
    mod.modResults.contents = src;
    return mod;
  });
};
