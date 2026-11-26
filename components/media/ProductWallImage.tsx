import { Image, type ImageContentFit, type ImageProps } from "expo-image";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { PRODUCT_WALL_BG } from "@/src/product-wall-image";

type Props = {
  uri: string;
  style?: StyleProp<ViewStyle>;
  /** Forcé : sinon cover stable (pas de clin d’œil). */
  contentFit?: ImageContentFit;
  recyclingKey?: string;
  blurBackdrop?: boolean;
  onLoad?: ImageProps["onLoad"];
};

const ratioCache = new Map<string, number>();

/**
 * Affichage produit stable type v27 : cover par défaut.
 * Paysage déjà mesuré (`ratio > 1`) : contain sans setState au 1er paint.
 */
export function ProductWallImage({
  uri,
  style,
  contentFit,
  recyclingKey,
  blurBackdrop = true,
  onLoad,
}: Props) {
  const ratio = ratioCache.get(uri) ?? null;
  const wide = ratio !== null && ratio > 1;
  const fit: ImageContentFit = contentFit ?? (wide ? "contain" : "cover");

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
        contentPosition={fit === "contain" ? "center" : "top"}
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey ?? uri}
        onLoad={(event) => {
          const nextW = event.source.width;
          const nextH = event.source.height;
          if (nextW > 0 && nextH > 0) {
            ratioCache.set(uri, nextW / nextH);
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
