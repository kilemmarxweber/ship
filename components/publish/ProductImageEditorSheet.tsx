import { Ionicons } from "@expo/vector-icons";
import { useEventListener } from "expo";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ViewShot, { type ViewShotRef } from "react-native-view-shot";

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

export type MontageMedia = {
  url: string;
  uri: string;
  video: boolean;
  width: number;
  ratio: number;
};

export type MontageSave =
  | { kind: "image"; targetUrl: string; uri: string; file?: Blob | null }
  | {
      kind: "video";
      targetUrl: string;
      text: string;
      position: StickerPosition;
      size: number;
    };

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

async function loadCanvasImage(uri: string) {
  const response = await fetch(uri, { mode: "cors", cache: "reload" });
  if (!response.ok) {
    throw new Error("Cette photo n’est pas disponible pour la retouche.");
  }
  return createImageBitmap(await response.blob());
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
  width: number,
  height: number,
) {
  const scale = Math.min(width / image.width, height / image.height);
  const drawnWidth = image.width * scale;
  const drawnHeight = image.height * scale;
  ctx.drawImage(
    image,
    (width - drawnWidth) / 2,
    (height - drawnHeight) / 2,
    drawnWidth,
    drawnHeight,
  );
}

function captionLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  if (ctx.measureText(text).width <= maxWidth) return [text];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !current) current = next;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

async function composeWebStill(input: {
  uri: string;
  logoUri: string | null;
  showLogo: boolean;
  coverPrice: boolean;
  caption: string;
  position: StickerPosition;
  size: number;
  width: number;
  height: number;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = input.width;
  canvas.height = input.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Retouche impossible");
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const photo = await loadCanvasImage(input.uri);
  drawContain(ctx, photo, canvas.width, canvas.height);
  if (input.showLogo && input.logoUri) {
    const logo = await loadCanvasImage(input.logoUri);
    const box = Math.round((canvas.width * input.size) / 100);
    const [vertical, horizontal] = input.position.split("-") as [
      "top" | "middle" | "bottom",
      "left" | "center" | "right",
    ];
    const x =
      horizontal === "left"
        ? canvas.width * 0.04
        : horizontal === "right"
          ? canvas.width * 0.96 - box
          : (canvas.width - box) / 2;
    const y =
      vertical === "top"
        ? canvas.height * 0.04
        : vertical === "bottom"
          ? canvas.height * 0.96 - box
          : (canvas.height - box) / 2;
    if (input.coverPrice) {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(x, y, box, box);
    }
    const scale = Math.min(
      (box * 0.72) / logo.width,
      (box * 0.72) / logo.height,
    );
    const logoWidth = logo.width * scale;
    const logoHeight = logo.height * scale;
    ctx.drawImage(
      logo,
      x + (box - logoWidth) / 2,
      y + (box - logoHeight) / 2,
      logoWidth,
      logoHeight,
    );
  }
  if (input.caption) {
    const fontSize = Math.max(
      18,
      Math.round((canvas.width * input.size) / 380),
    );
    ctx.font = `800 ${fontSize}px sans-serif`;
    ctx.textBaseline = "top";
    const maxWidth = canvas.width * 0.88;
    const lines = captionLines(ctx, input.caption, maxWidth);
    const lineHeight = Math.round(fontSize * 1.15);
    const blockWidth = Math.max(
      ...lines.map((line) => ctx.measureText(line).width),
    );
    const blockHeight = lines.length * lineHeight;
    const [vertical, horizontal] = input.position.split("-") as [
      "top" | "middle" | "bottom",
      "left" | "center" | "right",
    ];
    const x =
      horizontal === "left"
        ? canvas.width * 0.05
        : horizontal === "right"
          ? canvas.width * 0.95 - blockWidth
          : (canvas.width - blockWidth) / 2;
    const y =
      vertical === "top"
        ? canvas.height * 0.06
        : vertical === "bottom"
          ? canvas.height * 0.94 - blockHeight
          : canvas.height * 0.4;
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    lines.forEach((line, index) => {
      const lineWidth = ctx.measureText(line).width;
      const lineX =
        horizontal === "right"
          ? x + blockWidth - lineWidth
          : horizontal === "center"
            ? x + (blockWidth - lineWidth) / 2
            : x;
      ctx.fillText(line, lineX, y + index * lineHeight);
    });
  }
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) =>
        value ? resolve(value) : reject(new Error("Retouche impossible")),
      "image/jpeg",
      0.92,
    );
  });
  return { uri: URL.createObjectURL(blob), file: blob };
}

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

function textAnchor(position: StickerPosition) {
  const [vertical, horizontal] = position.split("-") as [
    "top" | "middle" | "bottom",
    "left" | "center" | "right",
  ];
  return {
    left: horizontal === "right" ? undefined : horizontal === "left" ? "5%" : 0,
    right:
      horizontal === "left" ? undefined : horizontal === "right" ? "5%" : 0,
    top: vertical === "bottom" ? undefined : vertical === "top" ? "6%" : "40%",
    bottom:
      vertical === "top" ? undefined : vertical === "bottom" ? "6%" : undefined,
    textAlign:
      horizontal === "left"
        ? ("left" as const)
        : horizontal === "right"
          ? ("right" as const)
          : ("center" as const),
  };
}

function MontageVideo({
  uri,
  onReady,
  onError,
}: {
  uri: string;
  onReady: () => void;
  onError: () => void;
}) {
  const player = useVideoPlayer(uri, (next) => {
    next.loop = true;
    next.muted = true;
    next.volume = 0;
    next.audioMixingMode = "mixWithOthers";
    void next.play();
  });
  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "readyToPlay") onReady();
    if (status === "error") onError();
  });

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
      surfaceType="textureView"
    />
  );
}

export function ProductImageEditorSheet({
  open,
  medias,
  initialUrl,
  logoUri,
  onClose,
  onSave,
}: {
  open: boolean;
  medias: MontageMedia[];
  initialUrl: string;
  logoUri?: string | null;
  onClose: () => void;
  onSave: (result: MontageSave) => Promise<boolean>;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const captureRef = useRef<ViewShotRef | null>(null);
  const [selectedUrl, setSelectedUrl] = useState(initialUrl);
  const [position, setPosition] = useState<StickerPosition>("bottom-center");
  const [size, setSize] = useState<(typeof SIZES)[number]>(32);
  const [stickerText, setStickerText] = useState("");
  const [coverPrice, setCoverPrice] = useState(false);
  const [showLogo, setShowLogo] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [logoReady, setLogoReady] = useState(!logoUri);
  const [busy, setBusy] = useState(false);
  const selected =
    medias.find((item) => item.url === selectedUrl) ?? medias[0] ?? null;
  const imageRatio =
    selected && Number.isFinite(selected.ratio) && selected.ratio > 0
      ? selected.ratio
      : 1;
  const previewWidth = Math.min(
    windowWidth - 40,
    420,
    Math.max(140, windowHeight * 0.42 * imageRatio),
  );
  const fontSize = Math.max(16, Math.round((previewWidth * size) / 380));
  const targetWidth = Math.max(1, Math.min(selected?.width || 1600, 2000));
  const outputScale = Math.min(
    1,
    2000 / Math.max(targetWidth, targetWidth / imageRatio),
  );
  const outputWidth = Math.max(1, Math.round(targetWidth * outputScale));
  const outputHeight = Math.max(1, Math.round(outputWidth / imageRatio));
  const logo = logoUri?.trim() || null;
  const caption = stickerText.trim();

  const stickerStyle = useMemo(
    () => stickerPositionStyle(position, size),
    [position, size],
  );
  const captionStyle = useMemo(() => textAnchor(position), [position]);

  const markReady = useCallback(() => {
    setImageReady(true);
    setImageFailed(false);
  }, []);
  const markFailed = useCallback(() => {
    setImageReady(false);
    setImageFailed(true);
  }, []);

  function chooseMedia(url: string) {
    if (url === selectedUrl) return;
    setSelectedUrl(url);
    setImageReady(false);
    setImageFailed(false);
  }

  async function save() {
    if (!selected || busy || !imageReady || (logo && showLogo && !logoReady)) {
      return;
    }
    if (selected.video && !caption) {
      showToast("Écris le texte à poser sur la vidéo", "info");
      return;
    }
    setBusy(true);
    let saved = false;
    try {
      if (selected.video) {
        saved = await onSave({
          kind: "video",
          targetUrl: selected.url,
          text: caption,
          position,
          size,
        });
      } else if (Platform.OS === "web") {
        const edited = await composeWebStill({
          uri: selected.uri,
          logoUri: logo,
          showLogo,
          coverPrice,
          caption,
          position,
          size,
          width: outputWidth,
          height: outputHeight,
        });
        saved = await onSave({
          kind: "image",
          targetUrl: selected.url,
          uri: edited.uri,
          file: edited.file,
        });
        URL.revokeObjectURL(edited.uri);
      } else {
        const viewShot = captureRef.current;
        if (!viewShot) {
          showToast("Aperçu de retouche indisponible", "error");
          return;
        }
        const editedUri = await viewShot.capture();
        saved = await onSave({
          kind: "image",
          targetUrl: selected.url,
          uri: editedUri,
        });
      }
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

  if (!selected) return null;

  const layers = (
    <>
      {selected.video ? (
        <MontageVideo
          key={selected.uri}
          uri={selected.uri}
          onReady={markReady}
          onError={markFailed}
        />
      ) : (
        <Image
          key={selected.uri}
          source={{ uri: selected.uri }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          onLoad={markReady}
          onError={markFailed}
        />
      )}
      {logo && showLogo ? (
        <View
          style={[
            styles.sticker,
            stickerStyle,
            {
              width: `${size}%`,
              aspectRatio: 1,
              backgroundColor: coverPrice ? "#FFFFFF" : "transparent",
            },
          ]}
        >
          <Image
            source={{ uri: logo }}
            style={styles.logo}
            contentFit="contain"
            onLoad={() => setLogoReady(true)}
            onError={() => setLogoReady(true)}
          />
        </View>
      ) : null}
      {caption ? (
        <Text
          style={[styles.caption, captionStyle, { fontSize }]}
          numberOfLines={2}
        >
          {caption}
        </Text>
      ) : null}
    </>
  );

  const frameStyle = [
    styles.canvas,
    { width: previewWidth, aspectRatio: imageRatio },
  ];
  const blocked =
    busy || !imageReady || Boolean(logo && showLogo && !logoReady);

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
            <Text style={[styles.title, { color: c.text }]}>
              {selected.video ? "Texte sur la vidéo" : "Texte sur la photo"}
            </Text>
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
          {medias.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.choices}
            >
              {medias.map((item, index) => {
                const active = item.url === selected.url;
                const label = item.video
                  ? `Vidéo ${index + 1}`
                  : `Photo ${index + 1}`;
                return (
                  <Pressable
                    key={item.url}
                    onPress={() => chooseMedia(item.url)}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.choice,
                      {
                        backgroundColor: active ? `${c.primary}22` : c.card,
                        borderColor: active ? c.primary : HAIRLINE,
                      },
                    ]}
                  >
                    <Ionicons
                      name={item.video ? "videocam" : "image"}
                      size={14}
                      color={active ? c.primary : c.textMuted}
                    />
                    <Text
                      style={[
                        styles.choiceText,
                        { color: active ? c.primary : c.text },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
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
            {selected.video ? (
              <View style={frameStyle}>{layers}</View>
            ) : (
              <ViewShot
                ref={captureRef}
                style={frameStyle}
                options={{
                  format: "jpg",
                  quality: 0.92,
                  result: "tmpfile",
                  width: outputWidth,
                  height: outputHeight,
                }}
              >
                {layers}
              </ViewShot>
            )}
            {imageFailed ? (
              <Text style={[styles.error, { color: "#F87171" }]}>
                {selected.video
                  ? "Cette vidéo n’est pas disponible pour le montage."
                  : "Cette photo n’est pas disponible pour la retouche."}
              </Text>
            ) : null}

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>
                Texte sur le produit
              </Text>
              <Text style={[styles.hint, { color: c.textMuted }]}>
                Seulement le texte, sans fond. La photo ou la vidéo reste
                visible derrière.
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
              <View style={styles.positions}>
                {POSITIONS.map((item) => {
                  const active = position === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setPosition(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      accessibilityState={{ selected: active }}
                      style={[
                        styles.position,
                        {
                          backgroundColor: active ? c.primary : c.card,
                          borderColor: active ? c.primary : HAIRLINE,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.positionDot,
                          {
                            backgroundColor: active
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
                  const active = size === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setSize(value)}
                      style={[
                        styles.size,
                        {
                          backgroundColor: active ? `${c.primary}22` : c.card,
                          borderColor: active ? c.primary : HAIRLINE,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sizeText,
                          { color: active ? c.primary : c.text },
                        ]}
                      >
                        {value === 22
                          ? "Petit"
                          : value === 32
                            ? "Moyen"
                            : "Grand"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {logo && showLogo ? (
                <Pressable
                  onPress={() => setCoverPrice((value) => !value)}
                  style={[
                    styles.toggle,
                    {
                      alignSelf: "flex-start",
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
                    {coverPrice ? "Masquer une zone" : "Logo seul"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>

          <Pressable
            onPress={() => void save()}
            disabled={blocked}
            style={[
              styles.save,
              {
                backgroundColor: c.primary,
                opacity: blocked ? 0.55 : 1,
              },
            ]}
          >
            {busy ? <ActivityIndicator color={c.primaryForeground} /> : null}
            <Text style={[styles.saveText, { color: c.primaryForeground }]}>
              {busy
                ? "Enregistrement…"
                : selected.video
                  ? "Écrire sur la vidéo"
                  : "Écrire sur la photo"}
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
  choices: { gap: 8, paddingVertical: 2 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  choiceText: { fontSize: 12, fontWeight: "800" },
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
    overflow: "hidden",
  },
  logo: { width: "72%", height: "72%" },
  caption: {
    position: "absolute",
    color: "#FFFFFF",
    fontWeight: "800",
    backgroundColor: "transparent",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    includeFontPadding: false,
  },
  section: { width: "100%", gap: 8 },
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
