import { Redirect } from "expo-router";
import { View } from "react-native";

import { PublishCameraScreen } from "@/components/publish/PublishCameraScreen";
import { showToast } from "@/src/toast";

/** Preview DEV caméra Stories TikTok — /ui-preview-publish-camera */
export default function UiPreviewPublishCamera() {
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <PublishCameraScreen
        initialMode="photo"
        onClose={() => undefined}
        onCaptured={(asset) =>
          showToast(`Capturé · ${asset.fileName}`, "success")
        }
      />
    </View>
  );
}
