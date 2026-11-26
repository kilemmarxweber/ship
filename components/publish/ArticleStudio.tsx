import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import type { ImagePickerAsset } from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ShopPicker } from "@/components/profile/ShopPicker";
import { ArticleProcessingSheet } from "@/components/publish/ArticleProcessingSheet";
import { ArticleTemplatePanel } from "@/components/publish/ArticleTemplateSheet";
import {
    MusicStudio,
    type MusicStudioHandle,
} from "@/components/publish/MusicStudio";
import { ProductFiltersScreen } from "@/components/publish/ProductFiltersScreen";
import {
    ProductImageEditorSheet,
    type MontageMedia,
    type MontageSave,
} from "@/components/publish/ProductImageEditorSheet";
import {
    PublishCameraScreen,
    type PublishCameraModeId,
} from "@/components/publish/PublishCameraScreen";
import { api, apiUpload, isVideoUrl, mediaUrl } from "@/src/api";
import { VIDEO_STYLE_MODELS, type VideoStyleModel } from "@/src/image-style";
import { pickFromCamera, pickMediaLibrary } from "@/src/pick-media";
import type { ProductFilterSelection } from "@/src/product-filters";
import {
    encodeSlideMotion,
    LOCAL_SOUNDTRACK_ID,
    type LocalSoundtrackClip,
} from "@/src/soundtrack";
import { useTabBarMetrics } from "@/src/tab-bar-metrics";
import { HAIRLINE } from "@/src/theme";
import { showToast } from "@/src/toast";
import { appendUploadFile } from "@/src/upload-file";
import { useColors } from "@/src/use-colors";

type StudioShop = {
  id: string;
  name: string;
  currency?: string;
  logoUrl?: string | null;
};

type EmptyCaptureMode =
  | "video-15"
  | "video-30"
  | "video-60"
  | "upload"
  | "photo";

const EMPTY_CAPTURE_MODES: {
  id: EmptyCaptureMode;
  label: string;
}[] = [
  { id: "video-60", label: "60s" },
  { id: "video-30", label: "30s" },
  { id: "video-15", label: "15s" },
  { id: "upload", label: "+" },
  { id: "photo", label: "camera" },
];

const EMPTY_MODE_W = 78;
/** Départ centré sur + upload (60s → 30s → 15s → + → photo). */
const EMPTY_START_INDEX = EMPTY_CAPTURE_MODES.findIndex(
  (m) => m.id === "upload",
);
const EMPTY_MODE_PAD = Math.max(
  0,
  (Dimensions.get("window").width - EMPTY_MODE_W) / 2,
);

function EmptyCaptureChip({
  item,
  index,
  scrollX,
  busy,
  onPress,
}: {
  item: (typeof EMPTY_CAPTURE_MODES)[number];
  index: number;
  scrollX: SharedValue<number>;
  busy: boolean;
  onPress: () => void;
}) {
  const anim = useAnimatedStyle(() => {
    const center = index * EMPTY_MODE_W;
    const dist = Math.abs(scrollX.value - center);
    const isUpload = item.id === "upload";
    const scale = interpolate(
      dist,
      [0, EMPTY_MODE_W, EMPTY_MODE_W * 2],
      [isUpload ? 1.18 : 1.06, 0.88, 0.78],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      dist,
      [0, EMPTY_MODE_W * 0.55, EMPTY_MODE_W * 1.4],
      [1, isUpload ? 0.55 : 0.38, isUpload ? 0.28 : 0.22],
      Extrapolation.CLAMP,
    );
    return { transform: [{ scale }], opacity };
  });

  const upload = item.id === "upload";

  return (
    <Pressable
      onPress={onPress}
      style={styles.emptyModeItem}
      accessibilityLabel={
        upload
          ? "Ouvrir la galerie"
          : item.id === "photo"
            ? "Caméra photo"
            : `Caméra vidéo ${item.label}`
      }
    >
      <Animated.View
        style={[
          upload ? styles.emptyIcon : styles.modeChip,
          upload ? null : item.id === "photo" && styles.modeChipPhoto,
          anim,
        ]}
      >
        {upload ? (
          busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Ionicons name="add" size={36} color="#FFFFFF" />
          )
        ) : item.id === "photo" ? (
          <Ionicons name="camera" size={26} color="#FFFFFF" />
        ) : (
          <Text style={styles.modeChipText}>{item.label}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

function EmptyCaptureStrip({
  busy,
  onSelect,
}: {
  busy: boolean;
  onSelect: (mode: EmptyCaptureMode) => void;
}) {
  const listRef =
    useRef<Animated.FlatList<(typeof EMPTY_CAPTURE_MODES)[number]>>(null);
  const scrollX = useSharedValue(EMPTY_START_INDEX * EMPTY_MODE_W);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  useEffect(() => {
    const t = setTimeout(() => {
      listRef.current?.scrollToOffset({
        offset: EMPTY_START_INDEX * EMPTY_MODE_W,
        animated: false,
      });
      scrollX.value = EMPTY_START_INDEX * EMPTY_MODE_W;
    }, 30);
    return () => clearTimeout(t);
  }, [scrollX]);

  function snapToNearest(x: number) {
    const index = Math.round(x / EMPTY_MODE_W);
    const clamped = Math.max(
      0,
      Math.min(EMPTY_CAPTURE_MODES.length - 1, index),
    );
    listRef.current?.scrollToOffset({
      offset: clamped * EMPTY_MODE_W,
      animated: true,
    });
    // eslint-disable-next-line react-hooks/immutability
    scrollX.value = clamped * EMPTY_MODE_W;
  }

  return (
    <Animated.FlatList
      ref={listRef}
      horizontal
      data={EMPTY_CAPTURE_MODES}
      keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      snapToInterval={EMPTY_MODE_W}
      decelerationRate="fast"
      disableIntervalMomentum
      bounces={false}
      style={styles.modeScroll}
      contentContainerStyle={{ paddingHorizontal: EMPTY_MODE_PAD }}
      onScroll={onScroll}
      onMomentumScrollEnd={(e) => snapToNearest(e.nativeEvent.contentOffset.x)}
      scrollEventThrottle={16}
      getItemLayout={(_, index) => ({
        length: EMPTY_MODE_W,
        offset: EMPTY_MODE_W * index,
        index,
      })}
      renderItem={({ item, index }) => (
        <EmptyCaptureChip
          item={item}
          index={index}
          scrollX={scrollX}
          busy={busy}
          onPress={() => {
            listRef.current?.scrollToOffset({
              offset: index * EMPTY_MODE_W,
              animated: true,
            });
            scrollX.value = index * EMPTY_MODE_W;
            onSelect(item.id);
          }}
        />
      )}
    />
  );
}

async function optimizeStill(uri: string): Promise<string> {
  const { normalizeProductWallStill } = await import("@/src/product-wall-image");
  return normalizeProductWallStill(uri);
}

async function uploadAsset(asset: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  file?: Blob | null;
}) {
  const form = new FormData();
  await appendUploadFile(form, asset);
  form.append("variant", "product");
  const uploaded = await apiUpload<{ url?: string; posterUrl?: string }>(
    "/api/upload",
    form,
  );
  const url = uploaded.url;
  if (!url) throw new Error("Média non reçu");
  return uploaded.posterUrl ? [uploaded.posterUrl, url] : [url];
}

function StudioVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (next) => {
    next.loop = true;
    next.muted = true;
    next.volume = 0;
    next.audioMixingMode = "mixWithOthers";
    void next.play();
  });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
    />
  );
}

const TOOLS: {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}[] = [
  { id: "layout", icon: "logo-instagram", label: "Modèles" },
  { id: "share", icon: "arrow-redo-outline", label: "Partager" },
  { id: "frames", icon: "copy-outline", label: "Cadres" },
  { id: "video", icon: "play-circle-outline", label: "Vidéo" },
  { id: "text", icon: "text", label: "Texte" },
  { id: "sticker", icon: "happy-outline", label: "Stickers" },
  { id: "filters", icon: "color-filter-outline", label: "Filtres" },
  { id: "crop", icon: "crop-outline", label: "Recadrer" },
  { id: "enhance", icon: "sparkles-outline", label: "Améliorer" },
];

export function ArticleStudio({
  shops,
  shopId,
  onShopId,
  images,
  onImages,
  soundtrackId,
  onSoundtrackId,
  soundtrackStartMs,
  onSoundtrackStartMs,
  localClip,
  onLocalClip,
  imageMotions,
  onImageMotions,
  mediaBusy,
  setMediaBusy,
  shopLogoUrl,
  onBack,
  onNext,
  onStory,
}: {
  shops: StudioShop[];
  shopId: string;
  onShopId: (id: string) => void;
  images: string[];
  onImages: (next: string[]) => void;
  soundtrackId: string | null;
  onSoundtrackId: (id: string | null) => void;
  soundtrackStartMs: number;
  onSoundtrackStartMs: (ms: number) => void;
  localClip: LocalSoundtrackClip | null;
  onLocalClip: (clip: LocalSoundtrackClip | null) => void;
  imageMotions: string[];
  onImageMotions: (next: string[]) => void;
  mediaBusy: boolean;
  setMediaBusy: (v: boolean) => void;
  shopLogoUrl?: string | null;
  onBack: () => void;
  onNext: () => void;
  onStory: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarMetrics();
  const musicRef = useRef<MusicStudioHandle>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [musicOpen, setMusicOpen] = useState(false);
  const bottomPad = tabBar.barBody + Math.max(insets.bottom, 8) + 10;
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterSelection, setFilterSelection] =
    useState<ProductFilterSelection | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<PublishCameraModeId>("photo");
  const [shopOpen, setShopOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [trackTitle, setTrackTitle] = useState<string | null>(null);
  const urlsRef = useRef(images);

  useEffect(() => {
    urlsRef.current = images;
  }, [images]);

  const safeIndex =
    images.length === 0
      ? 0
      : Math.min(activeIndex, Math.max(0, images.length - 1));
  const activeUrl = images[safeIndex] ?? null;
  const activeUri = activeUrl ? (mediaUrl(activeUrl) ?? activeUrl) : null;
  const activeIsVideo = activeUrl ? isVideoUrl(activeUrl) : false;

  const selectedModelId = useMemo(() => {
    if (!imageMotions.length) return null;
    const joined = imageMotions.join("|");
    for (const model of VIDEO_STYLE_MODELS) {
      const encoded = model.motions.map((m) => encodeSlideMotion(m)).join("|");
      if (joined.startsWith(encoded) || joined === encoded) return model.id;
    }
    return null;
  }, [imageMotions]);

  const montageMedias: MontageMedia[] = useMemo(
    () =>
      images.map((url) => ({
        url,
        uri: mediaUrl(url) ?? url,
        video: isVideoUrl(url),
        width: 0,
        ratio: isVideoUrl(url) ? 9 / 16 : 1,
      })),
    [images],
  );

  const ingest = useCallback(
    async (assets: ImagePickerAsset[]) => {
      if (!assets.length) return;
      setMediaBusy(true);
      setUploadPct(0);
      try {
        const next = [...urlsRef.current];
        let index = 0;
        for (const asset of assets) {
          if (next.length >= 12) break;
          index += 1;
          setUploadPct(Math.round((index / assets.length) * 100));
          const isVideo = (asset.type ?? "").includes("video");
          let uploadUri = asset.uri;
          if (!isVideo) uploadUri = await optimizeStill(asset.uri);
          const uploaded = await uploadAsset({ ...asset, uri: uploadUri });
          for (const url of uploaded) {
            if (!next.includes(url) && next.length < 12) next.push(url);
          }
        }
        urlsRef.current = next;
        onImages(next);
        if (next.length) setActiveIndex(next.length - 1);
      } catch (cause) {
        showToast(
          cause instanceof Error ? cause.message : "Import impossible",
          "error",
        );
      } finally {
        setMediaBusy(false);
        setUploadPct(0);
      }
    },
    [onImages, setMediaBusy],
  );

  /** + = galerie · 15s/30s/60s/photo = ouvre la caméra */
  async function captureMedia(
    mode: "upload" | "video-60" | "video-30" | "video-15" | "photo",
  ) {
    if (mediaBusy) {
      showToast("Patiente, le média se charge encore.", "info");
      return;
    }
    if (images.length >= 12) return;

    if (mode === "upload") {
      const limit = Math.max(1, 12 - images.length);
      setMediaBusy(true);
      try {
        const picked = await pickMediaLibrary({ kind: "mixed", limit });
        if (!picked.length) {
          setMediaBusy(false);
          return;
        }
        await ingest(picked);
      } catch (cause) {
        setMediaBusy(false);
        showToast(
          cause instanceof Error ? cause.message : "Galerie impossible",
          "error",
        );
      }
      return;
    }

    // Android : la caméra système se lance vraiment (CameraView embarquée échoue souvent).
    if (Platform.OS === "android") {
      const video =
        mode === "video-15" || mode === "video-30" || mode === "video-60";
      const maxDuration =
        mode === "video-15" ? 15 : mode === "video-30" ? 30 : 60;
      setMediaBusy(true);
      try {
        const picked = await pickFromCamera({
          kind: video ? "videos" : "images",
          facing: "front",
          videoMaxDuration: maxDuration,
        });
        if (!picked.length) {
          setMediaBusy(false);
          return;
        }
        await ingest(picked);
      } catch (cause) {
        setMediaBusy(false);
        showToast(
          cause instanceof Error ? cause.message : "Caméra impossible",
          "error",
        );
      }
      return;
    }

    const nextMode: PublishCameraModeId =
      mode === "photo"
        ? "photo"
        : mode === "video-15"
          ? "15s"
          : mode === "video-30"
            ? "30s"
            : "60s";
    setCameraMode(nextMode);
    setCameraOpen(true);
  }

  async function addMedia(kind: "mixed" | "videos" = "mixed") {
    if (kind === "videos") {
      await captureMedia("video-60");
      return;
    }
    await captureMedia("upload");
  }

  async function onCameraCaptured(asset: {
    uri: string;
    fileName: string;
    mimeType: string;
  }) {
    setCameraOpen(false);
    if (images.length >= 12) return;
    const video = asset.mimeType.startsWith("video/");
    await ingest([
      {
        uri: asset.uri,
        width: 0,
        height: 0,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        type: video ? "video" : "image",
      } as ImagePickerAsset,
    ]);
  }

  function clearSound() {
    onLocalClip(null);
    onSoundtrackId(null);
    onSoundtrackStartMs(0);
    setTrackTitle(null);
  }

  function applyTemplate(model: VideoStyleModel) {
    const motions = model.motions.map((m) => encodeSlideMotion(m));
    const next = images.map((_, i) => motions[i % motions.length]!);
    onImageMotions(next);
    setTemplatesOpen(false);
    showToast(`Modèle « ${model.label} » appliqué`, "success");
  }

  function onTool(id: string) {
    switch (id) {
      case "layout":
      case "frames":
        setTemplatesOpen(true);
        break;
      case "filters":
        if (!images.length) {
          showToast("Ajoute d’abord une photo ou vidéo", "info");
          return;
        }
        setFiltersOpen(true);
        break;
      case "video":
        void addMedia("videos");
        break;
      case "text":
      case "sticker":
      case "crop":
      case "enhance":
        if (!images.length) {
          showToast("Ajoute d’abord une photo ou vidéo", "info");
          return;
        }
        setEditing(true);
        break;
      case "share":
        showToast("Continue avec Suivant pour publier", "info");
        break;
      default:
        break;
    }
  }

  function captureFilterVideo() {
    setFiltersOpen(false);
    void captureMedia("video-60");
  }

  async function handleMontageSave(result: MontageSave) {
    setMediaBusy(true);
    try {
      let replacement = "";
      if (result.kind === "video") {
        const captioned = await api<{ url?: string }>("/api/media/caption", {
          method: "POST",
          body: JSON.stringify({
            url: result.targetUrl,
            text: result.text,
            position: result.position,
            size: result.size,
          }),
        });
        replacement = captioned.url ?? "";
        if (!replacement) throw new Error("Vidéo retouchée non reçue");
      } else {
        const uploaded = await uploadAsset({
          uri: result.uri,
          fileName: "retouched-product.jpg",
          mimeType: "image/jpeg",
          file: result.file,
        });
        replacement = uploaded[0] ?? "";
      }
      if (!replacement) throw new Error("Média non reçu");
      const next = urlsRef.current.map((url) =>
        url === result.targetUrl ? replacement : url,
      );
      urlsRef.current = next;
      onImages(next);
      setEditing(false);
      return true;
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Retouche impossible",
        "error",
      );
      return false;
    } finally {
      setMediaBusy(false);
    }
  }

  const canContinue = Boolean(shopId && images.length && !mediaBusy);
  const musicLabel =
    trackTitle ||
    (soundtrackId === LOCAL_SOUNDTRACK_ID && localClip
      ? localClip.title
      : soundtrackId
        ? "Son sélectionné"
        : "Ajouter un son");

  return (
    <View style={styles.root}>
      <View style={styles.canvas}>
        {activeUri ? (
          activeIsVideo ? (
            <StudioVideo uri={activeUri} />
          ) : (
            <Image
              source={{ uri: activeUri }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
            />
          )
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Ajoute des photos ou vidéos</Text>
            <EmptyCaptureStrip
              busy={mediaBusy}
              onSelect={(mode) => void captureMedia(mode)}
            />
          </View>
        )}
      </View>

      <View
        pointerEvents="box-none"
        style={[styles.overlay, { paddingTop: insets.top + 4 }]}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={onBack}
            hitSlop={10}
            style={styles.iconHit}
            accessibilityLabel="Retour"
          >
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </Pressable>

          <Pressable
            style={styles.musicPill}
            onPress={() => setMusicOpen(true)}
            accessibilityLabel="Choisir un son"
          >
            <Ionicons name="musical-notes" size={14} color="#FFFFFF" />
            <Text style={styles.musicText} numberOfLines={1}>
              {musicLabel}
            </Text>
            {soundtrackId ? (
              <Pressable
                onPress={() => clearSound()}
                hitSlop={8}
                accessibilityLabel="Retirer le son"
              >
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </Pressable>

          <Pressable
            onPress={() => setShopOpen((v) => !v)}
            hitSlop={10}
            style={styles.iconHit}
            accessibilityLabel="Boutique"
          >
            <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        {shopOpen ? (
          <View style={styles.shopCard}>
            <Text style={styles.shopLabel}>Boutique</Text>
            <ShopPicker
              shops={shops}
              value={shopId}
              placeholder="Choisir une boutique"
              onChange={onShopId}
            />
          </View>
        ) : null}

        <View style={styles.rightRail}>
          {TOOLS.map((tool) => (
            <Pressable
              key={tool.id}
              onPress={() => onTool(tool.id)}
              style={styles.toolBtn}
              accessibilityLabel={tool.label}
              hitSlop={6}
            >
              <Ionicons name={tool.icon} size={22} color="#FFFFFF" />
            </Pressable>
          ))}
        </View>

        <View style={[styles.bottom, { paddingBottom: bottomPad }]}>
          {templatesOpen ? (
            <ArticleTemplatePanel
              visible
              selectedId={selectedModelId}
              previewUrl={activeUrl}
              onSelect={applyTemplate}
              onClose={() => setTemplatesOpen(false)}
            />
          ) : (
            <>
              <Pressable
                onPress={() => setTemplatesOpen(true)}
                style={styles.chevronDown}
                hitSlop={8}
                accessibilityLabel="Modèles"
              >
                <Ionicons name="chevron-down" size={18} color="#FFFFFF" />
              </Pressable>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbs}
              >
                <Pressable
                  onPress={() => setTemplatesOpen(true)}
                  style={styles.thumbSlot}
                  accessibilityLabel="Grille modèles"
                >
                  <Ionicons
                    name="grid-outline"
                    size={22}
                    color="rgba(255,255,255,0.55)"
                  />
                </Pressable>

                {images.map((url, index) => {
                  const uri = mediaUrl(url) ?? url;
                  const on = index === safeIndex;
                  return (
                    <Pressable
                      key={`${url}-${index}`}
                      onPress={() => setActiveIndex(index)}
                      style={[styles.thumb, on && styles.thumbOn]}
                    >
                      <Image
                        source={{ uri }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                      />
                      {isVideoUrl(url) ? (
                        <View style={styles.vidBadge}>
                          <Ionicons name="play" size={10} color="#fff" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}

                {images.length < 12 ? (
                  <Pressable
                    onPress={() => void captureMedia("upload")}
                    style={styles.thumbSlot}
                    accessibilityLabel="Ajouter un média"
                  >
                    {mediaBusy ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Ionicons
                        name="add"
                        size={26}
                        color="rgba(255,255,255,0.7)"
                      />
                    )}
                  </Pressable>
                ) : null}
              </ScrollView>
            </>
          )}

          <View style={styles.actions}>
            <Pressable
              style={[
                styles.storyBtn,
                { backgroundColor: c.white },
                !canContinue && styles.disabled,
              ]}
              disabled={!canContinue}
              onPress={onStory}
              accessibilityRole="button"
              accessibilityLabel="Ma story"
            >
              {shopLogoUrl ? (
                <Image
                  source={{ uri: mediaUrl(shopLogoUrl) ?? shopLogoUrl }}
                  style={[styles.avatar, { borderColor: c.primary }]}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    styles.avatar,
                    styles.avatarFallback,
                    { borderColor: c.primary },
                  ]}
                >
                  <Ionicons name="person" size={14} color={c.ink} />
                </View>
              )}
              <Text
                style={[styles.storyText, { color: c.ink }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                Ma story
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.nextBtn,
                { backgroundColor: c.primary },
                !canContinue && styles.disabled,
              ]}
              disabled={!canContinue}
              onPress={onNext}
              accessibilityRole="button"
              accessibilityLabel="Suivant"
            >
              <Text
                style={[styles.nextText, { color: c.primaryForeground }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {mediaBusy ? "Upload…" : "Suivant"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <MusicStudio
        ref={musicRef}
        hideEntry
        open={musicOpen}
        onOpenChange={setMusicOpen}
        productTitle=""
        images={images}
        soundtrackId={soundtrackId}
        onSoundtrackId={(id) => {
          onSoundtrackId(id);
          if (!id) setTrackTitle(null);
        }}
        startMs={soundtrackStartMs}
        onStartMs={onSoundtrackStartMs}
        localClip={localClip}
        onLocalClip={(clip) => {
          onLocalClip(clip);
          if (clip) setTrackTitle(clip.title);
        }}
        imageMotions={imageMotions}
        onImageMotions={onImageMotions}
        storyChrome
        onTrackLabel={setTrackTitle}
      />

      {editing && images[0] ? (
        <ProductImageEditorSheet
          open={editing}
          medias={montageMedias}
          initialUrl={activeUrl ?? images[0]}
          logoUri={shopLogoUrl}
          onClose={() => setEditing(false)}
          onSave={handleMontageSave}
        />
      ) : null}

      <ArticleProcessingSheet
        visible={mediaBusy && uploadPct > 0}
        progress={uploadPct}
        title="Traitement..."
        subtitle="Reste sur cet écran pour terminer le traitement"
      />

      {filtersOpen && activeUrl ? (
        <View style={styles.filtersOverlay}>
          <ProductFiltersScreen
            productImageUrl={activeUrl}
            productTitle={
              filterSelection?.category === "beaute"
                ? "Makeup look"
                : "T-shirt Oversize"
            }
            productCategory="mode haut"
            onClose={() => setFiltersOpen(false)}
            onApply={setFilterSelection}
            onNewVideo={captureFilterVideo}
          />
        </View>
      ) : null}

      {cameraOpen ? (
        <View style={styles.filtersOverlay}>
          <PublishCameraScreen
            key={cameraMode}
            initialMode={cameraMode}
            onClose={() => setCameraOpen(false)}
            onCaptured={(asset) => void onCameraCaptured(asset)}
            onOpenSound={() => {
              setCameraOpen(false);
              setMusicOpen(true);
            }}
            onTexte={() => {
              setCameraOpen(false);
              if (images.length) setEditing(true);
              else showToast("Capture d’abord une photo", "info");
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  canvas: { ...StyleSheet.absoluteFill, backgroundColor: "#000000" },
  filtersOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    backgroundColor: "#000000",
  },
  overlay: { flex: 1, justifyContent: "space-between" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 8,
  },
  iconHit: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  musicPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    maxWidth: 220,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(28,28,30,0.92)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  musicText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  shopCard: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(28,28,30,0.96)",
    gap: 8,
  },
  shopLabel: {
    color: "rgba(255,255,255,0.55)",
    fontWeight: "700",
    fontSize: 12,
  },
  rightRail: {
    position: "absolute",
    right: 6,
    top: 96,
    // Laisse la place aux miniatures + Ma Story / Suivant + tab bar.
    bottom: 210,
    gap: 6,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  toolBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  bottom: {
    gap: 8,
    paddingHorizontal: 12,
    zIndex: 2,
  },
  chevronDown: { alignSelf: "center", paddingVertical: 2 },
  thumbs: {
    gap: 8,
    alignItems: "center",
    paddingHorizontal: 4,
    minHeight: 64,
  },
  thumbSlot: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderCurve: "continuous",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbOn: { borderColor: "#FFFFFF" },
  vidBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  storyBtn: {
    flex: 1.15,
    minHeight: 52,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: "visible",
  },
  storyText: {
    flexShrink: 1,
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.2,
    includeFontPadding: false,
    textAlign: "center",
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    flexShrink: 0,
  },
  avatarFallback: {
    backgroundColor: "#E8E8ED",
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    overflow: "visible",
  },
  nextText: {
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.2,
    includeFontPadding: false,
    textAlign: "center",
  },
  disabled: { opacity: 0.45 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  modeScroll: { flexGrow: 0, width: "100%", height: 88 },
  emptyModeItem: {
    width: EMPTY_MODE_W,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  modeChip: {
    minWidth: 56,
    height: 56,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  modeChipPhoto: {
    width: 56,
    paddingHorizontal: 0,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.4)",
  },
  modeChipText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "800",
    includeFontPadding: false,
  },
  modeChipTextPhoto: { color: "#FFFFFF", fontSize: 13 },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 4,
  },
});
