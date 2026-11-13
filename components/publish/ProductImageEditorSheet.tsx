import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import ViewShot, { type ViewShotRef } from "react-native-view-shot";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SheetReduce } from "@/components/ui/SheetReduce";
import { HAIRLINE } from "@/src/theme";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";

type StickerPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

const POSITIONS: { id: StickerPosition; label: string }[] = [
  { id: "top-left", label: "Haut gauche" },
  { id: "top-center", label: "Haut centre" },
  { id: "top-right", label: "Haut droite" },
  { id: "middle-left", label: "Milieu gauche" },
  { id: "middle-center", label: "Milieu" },
  { id: "middle-right", label: "Milieu droite" },
  { id: "bottom-left", label: "Bas gauche" },
  { id: "bottom-center", label: "Bas centre" },
  { id: "bottom-right", label: "Bas droite" },
];

const SIZES = [22, 32, 42] as const;

function stickerPositionStyle(position: StickerPosition, size: number) {
  const [vertical, horizontal] = position.split("-") as [
    "top" | "middle" | "bottom",
    "left" | "center" | "right",
  ];
  const left =
    horizontal === "left"
      ? "4%"
      : horizontal === "right"
        ? undefined
        : `${(100 - size) / 2}%`;
  const right = horizontal === "right" ? "4%" : undefined;
  const top =
    vertical === "top"
      ? "4%"
      : vertical === "bottom"
        ? undefined
        : `${(100 - size) / 2}%`;
  const bottom = vertical === "bottom" ? "4%" : undefined;
  return { left, right, top, bottom };
}

export function ProductImageEditorSheet({
  open,
  uri,
  logoUri,
  imageWidth,
  ratio,
  onClose,
  onSave,
}: {
  open: boolean;
  uri: string;
  logoUri?: string | null;
  imageWidth: number;
  ratio: number;
  onClose: () => void;
  onSave: (uri: string) => Promise<boolean>;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const captureRef = useRef<ViewShotRef | null>(null);
  const [position, setPosition] = useState<StickerPosition>("bottom-right");
  const [size, setSize] = useState<(typeof SIZES)[number]>(32);
  const [stickerText, setStickerText] = useState("");
  const [coverPrice, setCoverPrice] = useState(true);
  const [showLogo, setShowLogo] = useState(Boolean(logoUri));
  const [imageReady, setImageReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [logoReady, setLogoReady] = useState(!logoUri);
  const [busy, setBusy] = useState(false);
  const imageRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const previewWidth = Math.min(
    windowWidth - 40,
    420,
    Math.max(140, windowHeight * 0.42 * imageRatio),
  );
  const targetWidth = Math.max(1, Math.min(imageWidth || 1600, 2000));
  const outputScale = Math.min(
    1,
    2000 / Math.max(targetWidth, targetWidth / imageRatio),
  );
  const outputWidth = Math.max(1, Math.round(targetWidth * outputScale));
  const outputHeight = Math.max(1, Math.round(outputWidth / imageRatio));
  const logo = logoUri?.trim() || null;

  const stickerStyle = useMemo(
    () => stickerPositionStyle(position, size),
    [position, size],
  );

  async function save() {
    if (busy || !imageReady || (logo && showLogo && !logoReady)) return;
    const viewShot = captureRef.current;
    if (!viewShot) {
      showToast("Aperçu de retouche indisponible", "error");
      return;
    }
    setBusy(true);
    let saved = false;
    try {
      const editedUri = await viewShot.capture();
      saved = await onSave(editedUri);
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Retouche impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
    if (saved) onClose();
  }

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: c.sheet,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          <SheetReduce onPress={onClose} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>Retoucher</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fermer l’éditeur"
              hitSlop={8}
              style={styles.close}
            >
              <Ionicons name="close" size={22} color={c.text} />
            </Pressable>
          </View>
          {logo ? (
            <Pressable
              onPress={() => setShowLogo((value) => !value)}
              style={[
                styles.toggle,
                {
                  alignSelf: "flex-start",
                  backgroundColor: showLogo ? `${c.primary}22` : c.card,
                  borderColor: showLogo ? c.primary : HAIRLINE,
                },
              ]}
              accessibilityRole="switch"
              accessibilityState={{ checked: showLogo }}
            >
              <Text
                style={[
                  styles.toggleText,
                  { color: showLogo ? c.primary : c.textMuted },
                ]}
              >
                {showLogo ? "Logo de la boutique" : "Sans logo"}
              </Text>
            </Pressable>
          ) : null}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <ViewShot
              ref={captureRef}
              style={[
                styles.canvas,
                { width: previewWidth, aspectRatio: imageRatio },
              ]}
              options={{
                format: "jpg",
                quality: 0.92,
                result: "tmpfile",
                width: outputWidth,
                height: outputHeight,
              }}
            >
              <Image
                source={{ uri }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                onLoad={() => {
                  setImageReady(true);
                  setImageFailed(false);
                }}
                onError={() => {
                  setImageReady(false);
                  setImageFailed(true);
                }}
              />
              {showLogo || stickerText.trim() ? (
                <View
                  style={[
                    styles.sticker,
                    stickerStyle,
                    {
                      width: `${size}%`,
                      aspectRatio: 1,
                      backgroundColor: coverPrice
                        ? "#FFFFFF"
                        : "rgba(255,255,255,0.82)",
                    },
                  ]}
                >
                  {logo && showLogo ? (
                  <Image
                    source={{ uri: logo }}
                    style={styles.logo}
                    contentFit="contain"
                    onLoad={() => setLogoReady(true)}
                    onError={() => setLogoReady(true)}
                  />
                  ) : null}
                  {stickerText.trim() ? (
                    <Text style={styles.stickerText} numberOfLines={2}>
                      {stickerText.trim()}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </ViewShot>
            {imageFailed ? (
              <Text style={[styles.error, { color: "#F87171" }]}>
                Cette photo n’est pas disponible pour la retouche.
              </Text>
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={[styles.sectionTitle, { color: c.text }]}>
                  Logo et masquage
                </Text>
                <Pressable
                  onPress={() => setCoverPrice((value) => !value)}
                  style={[
                    styles.toggle,
                    {
                      backgroundColor: coverPrice ? `${c.primary}22` : c.card,
                      borderColor: coverPrice ? c.primary : HAIRLINE,
                    },
                  ]}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: coverPrice }}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      { color: coverPrice ? c.primary : c.textMuted },
                    ]}
                  >
                    {coverPrice ? "Masquer le prix" : "Fond transparent"}
                  </Text>
                </Pressable>
              </View>
              <Text style={[styles.hint, { color: c.textMuted }]}>
                Choisis la zone à recouvrir sur la photo.
              </Text>
              <View style={styles.positions}>
                {POSITIONS.map((item) => {
                  const selected = position === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setPosition(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      accessibilityState={{ selected }}
                      style={[
                        styles.position,
                        {
                          backgroundColor: selected ? c.primary : c.card,
                          borderColor: selected ? c.primary : HAIRLINE,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.positionDot,
                          {
                            backgroundColor: selected
                              ? c.primaryForeground
                              : c.textMuted,
                          },
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.sizes}>
                {SIZES.map((value) => {
                  const selected = size === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setSize(value)}
                      style={[
                        styles.size,
                        {
                          backgroundColor: selected ? `${c.primary}22` : c.card,
                          borderColor: selected ? c.primary : HAIRLINE,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sizeText,
                          { color: selected ? c.primary : c.text },
                        ]}
                      >
                        {value === 22 ? "Petit" : value === 32 ? "Moyen" : "Grand"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>
                Texte sur la photo
              </Text>
              <TextInput
                value={stickerText}
                onChangeText={setStickerText}
                maxLength={32}
                placeholder="Ajouter un texte"
                placeholderTextColor={c.textMuted}
                style={[
                  styles.input,
                  {
                    color: c.text,
                    backgroundColor: c.card,
                    borderColor: HAIRLINE,
                  },
                ]}
              />
            </View>
          </ScrollView>

          <Pressable
            onPress={() => void save()}
            disabled={
              busy ||
              !imageReady ||
              Boolean(logo && showLogo && !logoReady)
            }
            style={[
              styles.save,
              {
                backgroundColor: c.primary,
                opacity:
                  busy ||
                  !imageReady ||
                  Boolean(logo && showLogo && !logoReady)
                    ? 0.55
                    : 1,
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={c.primaryForeground} />
            ) : null}
            <Text style={[styles.saveText, { color: c.primaryForeground }]}>
              {busy ? "Enregistrement…" : "Appliquer à la photo"}
            </Text>
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
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  sheet: {
    maxHeight: "96%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  header: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 18, fontWeight: "800" },
  close: { padding: 4 },
  scroll: { flexShrink: 1 },
  content: { alignItems: "center", gap: 14, paddingBottom: 8 },
  canvas: {
    maxWidth: "100%",
    overflow: "hidden",
    backgroundColor: "#111",
  },
  sticker: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  logo: { width: "72%", height: "72%" },
  stickerText: {
    maxWidth: "100%",
    color: "#111827",
    textAlign: "center",
    fontSize: 10,
    fontWeight: "800",
  },
  section: { width: "100%", gap: 8 },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: "800" },
  hint: { fontSize: 12, lineHeight: 17 },
  error: { width: "100%", fontSize: 12, fontWeight: "700" },
  toggle: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toggleText: { fontSize: 11, fontWeight: "800" },
  positions: {
    width: 136,
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  position: {
    width: 38,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  positionDot: { width: 6, height: 6, borderRadius: 3 },
  sizes: { flexDirection: "row", justifyContent: "center", gap: 8 },
  size: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sizeText: { fontSize: 12, fontWeight: "700" },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  save: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveText: { fontSize: 14, fontWeight: "800" },
});
