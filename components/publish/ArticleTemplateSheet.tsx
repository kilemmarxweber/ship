import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { mediaUrl } from "@/src/api";
import { VIDEO_STYLE_MODELS, type VideoStyleModel } from "@/src/image-style";

import { colors } from "@/src/theme";

const ACCENT = colors.primary;

/** Panneau modèles (inline, au-dessus de Ma Story / Suivant). */
export function ArticleTemplatePanel({
  visible,
  selectedId,
  previewUrl,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedId: string | null;
  previewUrl?: string | null;
  onSelect: (model: VideoStyleModel) => void;
  onClose: () => void;
}) {
  if (!visible) return null;
  const cover = previewUrl ? (mediaUrl(previewUrl) ?? previewUrl) : null;

  return (
    <View style={styles.sheet}>
      <View style={styles.head}>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityLabel="Sans modèle"
          style={styles.headBtn}
        >
          <Ionicons name="ban-outline" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headTitle}>Sélectionner un modèle</Text>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityLabel="Fermer"
          style={styles.headBtn}
        >
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {VIDEO_STYLE_MODELS.map((model) => {
          const on = selectedId === model.id;
          return (
            <Pressable
              key={model.id}
              onPress={() => onSelect(model)}
              style={styles.item}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <View
                style={[
                  styles.thumb,
                  on && styles.thumbOn,
                  on && { borderColor: ACCENT },
                ]}
              >
                {cover ? (
                  <Image
                    source={{ uri: cover }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.placeholder}>
                    <Ionicons
                      name="images-outline"
                      size={22}
                      color="rgba(255,255,255,0.45)"
                    />
                  </View>
                )}
                {on ? <View style={styles.glow} /> : null}
              </View>
              <Text style={styles.label} numberOfLines={1}>
                {model.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** @deprecated alias — le panneau est maintenant inline */
export const ArticleTemplateSheet = ArticleTemplatePanel;

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: "#121212",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderCurve: "continuous",
    paddingTop: 4,
    gap: 12,
    marginHorizontal: -12,
    paddingBottom: 4,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    minHeight: 44,
  },
  headBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headTitle: {
    flex: 1,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  row: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 8,
  },
  item: { width: 84, gap: 6, alignItems: "center" },
  thumb: {
    width: 84,
    height: 112,
    borderRadius: 10,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: "#2A2A2E",
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbOn: {
    borderWidth: 2.5,
  },
  glow: {
    ...StyleSheet.absoluteFill,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    borderRadius: 8,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    width: "100%",
  },
});
