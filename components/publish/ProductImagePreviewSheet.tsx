import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mediaUrl } from "@/src/api";
import {
  formatRatio,
  orientationOf,
  type ProductImageMeta,
} from "@/src/product-image-intel";
import { HAIRLINE } from "@/src/theme";
import { useColors } from "@/src/use-colors";

export function ProductImagePreviewSheet({
  open,
  meta,
  onClose,
  onSetPrimary,
  onEdit,
  onCrop,
  onReplace,
  onRemove,
}: {
  open: boolean;
  meta: ProductImageMeta | null;
  onClose: () => void;
  onSetPrimary: () => void;
  onEdit: () => void;
  onCrop: () => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  if (!meta) return null;
  const uri = mediaUrl(meta.url) ?? meta.url;
  const orient = orientationOf(meta.ratio);

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: c.sheet,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <View style={styles.handle} />
          <Text style={[styles.title, { color: c.text }]}>Aperçu photo</Text>
          <Text style={[styles.meta, { color: c.textMuted }]}>
            {meta.width}×{meta.height} · {formatRatio(meta.ratio)} · {orient}
          </Text>
          {meta.warning ? (
            <View style={[styles.warn, { backgroundColor: "rgba(251,191,36,0.14)" }]}>
              <Ionicons name="warning-outline" size={16} color="#FBBF24" />
              <Text style={[styles.warnText, { color: c.text }]}>{meta.warning}</Text>
            </View>
          ) : null}
          {meta.tip ? (
            <Text style={[styles.tip, { color: c.textMuted }]}>{meta.tip}</Text>
          ) : null}

          <Text style={[styles.label, { color: c.textMuted }]}>Originale</Text>
          <View style={[styles.previewBox, { backgroundColor: c.background }]}>
            <Image source={{ uri }} style={styles.previewImg} contentFit="contain" />
          </View>

          <View
            style={[
              styles.productMock,
              { backgroundColor: "#0E0E14", borderColor: HAIRLINE },
            ]}
          >
            <Image source={{ uri }} style={styles.productMockImg} contentFit="contain" />
          </View>

          <Text style={[styles.label, { color: c.textMuted }]}>Plein écran</Text>
          <View style={[styles.fullMock, { backgroundColor: "#000" }]}>
            <Image source={{ uri }} style={styles.fullMockImg} contentFit="contain" />
          </View>

          <View style={styles.actions}>
            {!meta.isPrimary ? (
              <Pressable
                style={[styles.btn, { backgroundColor: `${c.primary}22` }]}
                onPress={onSetPrimary}
              >
                <Text style={[styles.btnText, { color: c.primary }]}>Principale</Text>
              </Pressable>
            ) : (
              <View style={[styles.btn, { backgroundColor: `${c.emerald}22` }]}>
                <Text style={[styles.btnText, { color: c.emerald }]}>★ Principale</Text>
              </View>
            )}
            {meta.width > 0 ? (
              <Pressable
                style={[styles.btn, { backgroundColor: `${c.primary}22` }]}
                onPress={onEdit}
              >
                <Text style={[styles.btnText, { color: c.primary }]}>
                  Retoucher
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.btn, { backgroundColor: c.card, borderColor: HAIRLINE, borderWidth: 1 }]}
              onPress={onCrop}
            >
              <Text style={[styles.btnText, { color: c.text }]}>Recadrer</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: c.card, borderColor: HAIRLINE, borderWidth: 1 }]}
              onPress={onReplace}
            >
              <Text style={[styles.btnText, { color: c.text }]}>Remplacer</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: "rgba(239,68,68,0.16)" }]}
              onPress={onRemove}
            >
              <Text style={[styles.btnText, { color: "#F87171" }]}>Supprimer</Text>
            </Pressable>
          </View>
          <Pressable onPress={onClose} style={styles.close}>
            <Text style={{ color: c.textMuted, fontWeight: "700" }}>Fermer</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: "92%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginBottom: 10,
  },
  title: { fontSize: 18, fontWeight: "800" },
  meta: { marginTop: 4, fontSize: 13, fontWeight: "600" },
  tip: { marginTop: 8, fontSize: 12, lineHeight: 17 },
  warn: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    alignItems: "flex-start",
  },
  warnText: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  label: {
    marginTop: 14,
    marginBottom: 6,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  previewBox: {
    height: 120,
    borderRadius: 14,
    overflow: "hidden",
  },
  previewImg: { width: "100%", height: "100%" },
  productMock: {
    height: 160,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  productMockImg: { width: "100%", height: "100%" },
  fullMock: {
    height: 100,
    borderRadius: 14,
    overflow: "hidden",
  },
  fullMockImg: { width: "100%", height: "100%" },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnText: { fontWeight: "800", fontSize: 13 },
  close: { alignItems: "center", marginTop: 14, paddingVertical: 8 },
});
