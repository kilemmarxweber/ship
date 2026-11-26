import { Image, type ImageContentFit, type ImageProps } from "expo-image";
import { useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import {
    PRODUCT_WALL_BG,
    PRODUCT_WALL_RATIO,
    wallNeedsContain,
} from "@/src/product-wall-image";

type Props = {
  uri: string;
  style?: StyleProp<ViewStyle>;
  /** Forcé : sinon auto selon ratio vs mur. */
  contentFit?: ImageContentFit;
  recyclingKey?: string;
  blurBackdrop?: boolean;
  onLoad?: ImageProps["onLoad"];
};

const ratioCache = new Map<string, number>();

/**
 * Affiche une photo produit sans coupe G/D quand elle est plus large que 9:16.
 */
export function ProductWallImage({
  uri,
  style,
  contentFit,
  recyclingKey,
  blurBackdrop = true,
  onLoad,
}: Props) {
  const [measured, setMeasured] = useState<{
    uri: string;
    ratio: number;
  } | null>(null);
  const ratio =
    measured?.uri === uri ? measured.ratio : (ratioCache.get(uri) ?? null);

  // Cover tant que le ratio est inconnu (pas de clin d’œil au scroll / préchargement).
  const letterbox =
    contentFit == null &&
    ratio !== null &&
    wallNeedsContain(ratio, 1, PRODUCT_WALL_RATIO);
  const fit: ImageContentFit = contentFit ?? (letterbox ? "contain" : "cover");

  return (
    <View style={[styles.frame, style]}>
      {blurBackdrop && fit === "contain" ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="center"
          blurRadius={36}
          cachePolicy="memory-disk"
          recyclingKey={`${recyclingKey ?? uri}-bg`}
        />
      ) : null}
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit={fit}
        contentPosition="center"
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey ?? uri}
        onLoad={(event) => {
          const nextW = event.source.width;
          const nextH = event.source.height;
          if (nextW > 0 && nextH > 0) {
            const next = nextW / nextH;
            ratioCache.set(uri, next);
            setMeasured({ uri, ratio: next });
          }
          onLoad?.(event);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    backgroundColor: PRODUCT_WALL_BG,
  },
});
