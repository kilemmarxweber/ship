import { Redirect } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { ArticleStudio } from "@/components/publish/ArticleStudio";
import type { LocalSoundtrackClip } from "@/src/soundtrack";

/**
 * Preview plein écran du studio « Publier un article » (sans auth, __DEV__ only).
 * Ouvre /ui-preview-article-studio pour valider le chrome Stories.
 */
export default function UiPreviewArticleStudio() {
  const [images, setImages] = useState<string[]>([]);
  const [soundtrackId, setSoundtrackId] = useState<string | null>(null);
  const [soundtrackStartMs, setSoundtrackStartMs] = useState(0);
  const [localClip, setLocalClip] = useState<LocalSoundtrackClip | null>(null);
  const [imageMotions, setImageMotions] = useState<string[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <ArticleStudio
        shops={[
          {
            id: "preview-shop",
            name: "ShipShop Preview",
            currency: "USD",
            logoUrl: null,
          },
        ]}
        shopId="preview-shop"
        onShopId={() => undefined}
        images={images}
        onImages={setImages}
        soundtrackId={soundtrackId}
        onSoundtrackId={setSoundtrackId}
        soundtrackStartMs={soundtrackStartMs}
        onSoundtrackStartMs={setSoundtrackStartMs}
        localClip={localClip}
        onLocalClip={setLocalClip}
        imageMotions={imageMotions}
        onImageMotions={setImageMotions}
        mediaBusy={mediaBusy}
        setMediaBusy={setMediaBusy}
        onBack={() => undefined}
        onNext={() => undefined}
        onStory={() => undefined}
      />
    </View>
  );
}
