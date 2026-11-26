import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
    type ListRenderItemInfo,
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

import { LiveFilterOverlay } from "@/components/live/LiveFilterOverlay";
import { AR_FILTERS } from "@/src/live-ar-filters";
import { MANNEQUINS } from "@/src/product-filters";
import { showToast } from "@/src/toast";
import { useLiveFacePose } from "@/src/use-live-face-pose";

export type PublishCameraModeId = "15s" | "30s" | "60s" | "photo" | "texte";

export type PublishCameraCapture = {
  uri: string;
  fileName: string;
  mimeType: string;
};

type ModeItem = {
  id: PublishCameraModeId;
  label: string;
  kind: "video" | "photo" | "texte";
  duration?: number;
};

const MODES: ModeItem[] = [
  { id: "60s", label: "60 s", kind: "video", duration: 60 },
  { id: "30s", label: "30 s", kind: "video", duration: 30 },
  { id: "15s", label: "15 s", kind: "video", duration: 15 },
  { id: "photo", label: "PHOTO", kind: "photo" },
  { id: "texte", label: "TEXTE", kind: "texte" },
];

const MODE_W = 88;
const { width: SCREEN_W } = Dimensions.get("window");
const MODE_PAD = Math.max(0, (SCREEN_W - MODE_W) / 2);

const CAMERA_FILTERS = AR_FILTERS.filter((f) => f.enabled).slice(0, 10);

type Props = {
  initialMode?: PublishCameraModeId;
  onClose: () => void;
  onCaptured: (asset: PublishCameraCapture) => void;
  onOpenSound?: () => void;
  onTexte?: () => void;
};

function ModeLabel({
  item,
  index,
  scrollX,
  selected,
  onPress,
}: {
  item: ModeItem;
  index: number;
  scrollX: SharedValue<number>;
  selected: boolean;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => {
    const center = index * MODE_W;
    const dist = Math.abs(scrollX.value - center);
    const scale = interpolate(
      dist,
      [0, MODE_W, MODE_W * 2],
      [1.12, 0.92, 0.86],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      dist,
      [0, MODE_W, MODE_W * 2],
      [1, 0.55, 0.35],
      Extrapolation.CLAMP,
    );
    return { transform: [{ scale }], opacity };
  });

  return (
    <Pressable
      onPress={onPress}
      style={styles.modeItem}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Animated.View
        style={[styles.modeInner, selected && styles.modeOn, style]}
      >
        <Text style={[styles.modeText, selected && styles.modeTextOn]}>
          {item.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function PublishCameraScreen({
  initialMode = "photo",
  onClose,
  onCaptured,
  onOpenSound,
  onTexte,
}: Props) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const listRef = useRef<Animated.FlatList<ModeItem>>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"front" | "back">("front");
  const [modeId, setModeId] = useState<PublishCameraModeId>(initialMode);
  const [filterId, setFilterId] = useState("none");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(Platform.OS === "web");
  const scrollX = useSharedValue(0);
  const { pose } = useLiveFacePose({ enabled: true, hz: 20 });

  const onModeScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  const modeIndex = useMemo(
    () =>
      Math.max(
        0,
        MODES.findIndex((m) => m.id === modeId),
      ),
    [modeId],
  );
  const activeMode = MODES[modeIndex] ?? MODES[3]!;

  useEffect(() => {
    if (permission && !permission.granted) void requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (Platform.OS === "web") {
        if (alive) setMicReady(true);
        return;
      }
      try {
        const Audio = await import("expo-audio");
        const current = await Audio.getRecordingPermissionsAsync();
        if (current.granted) {
          if (alive) setMicReady(true);
          return;
        }
        const asked = await Audio.requestRecordingPermissionsAsync();
        if (alive) setMicReady(asked.granted);
      } catch {
        if (alive) setMicReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(
      () => {
        listRef.current?.scrollToOffset({
          offset: modeIndex * MODE_W,
          animated: false,
        });
        scrollX.value = modeIndex * MODE_W;
      },
      Platform.OS === "android" ? 120 : 40,
    );
    return () => clearTimeout(t);
  }, [modeIndex, scrollX]);

  const selectMode = useCallback(
    (id: PublishCameraModeId, index: number, animated = true) => {
      if (id !== modeId) setCameraReady(false);
      setModeId(id);
      listRef.current?.scrollToOffset({
        offset: index * MODE_W,
        animated,
      });
      // eslint-disable-next-line react-hooks/immutability
      scrollX.value = index * MODE_W;
      if (id === "texte") {
        onTexte?.();
        showToast("Ajoute du texte après la capture", "info");
      }
    },
    [modeId, onTexte, scrollX],
  );

  function onModeMomentum(e: {
    nativeEvent: { contentOffset: { x: number } };
  }) {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / MODE_W);
    const clamped = Math.max(0, Math.min(MODES.length - 1, index));
    const next = MODES[clamped]!;
    if (next.id !== modeId) selectMode(next.id, clamped, false);
    else {
      listRef.current?.scrollToOffset({
        offset: clamped * MODE_W,
        animated: true,
      });
    }
  }

  async function shutter() {
    if (!cameraRef.current || busy) return;
    if (!cameraReady) {
      showToast("Caméra en cours d’ouverture…", "info");
      return;
    }
    if (activeMode.kind === "texte") {
      onTexte?.();
      showToast("Passe en PHOTO ou 15 s / 60 s pour capturer", "info");
      return;
    }

    if (activeMode.kind === "photo") {
      setBusy(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.88,
          skipProcessing: Platform.OS === "android",
        });
        if (!photo?.uri) throw new Error("Capture impossible");
        onCaptured({
          uri: photo.uri,
          fileName: "camera.jpg",
          mimeType: "image/jpeg",
        });
      } catch (cause) {
        showToast(
          cause instanceof Error ? cause.message : "Capture impossible",
          "error",
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!micReady) {
      showToast("Autorise le micro pour filmer une vidéo.", "info");
      return;
    }

    if (recording) {
      setBusy(true);
      try {
        cameraRef.current.stopRecording();
      } finally {
        setRecording(false);
        setBusy(false);
      }
      return;
    }

    const maxDuration = activeMode.duration ?? 60;
    setBusy(true);
    setRecording(true);
    try {
      // Android : laisse le mode vidéo se stabiliser avant recordAsync.
      if (Platform.OS === "android") {
        await new Promise((resolve) => setTimeout(resolve, 180));
      }
      const video = await cameraRef.current.recordAsync({ maxDuration });
      setRecording(false);
      if (!video?.uri) throw new Error("Enregistrement impossible");
      onCaptured({
        uri: video.uri,
        fileName: "camera.mp4",
        mimeType: "video/mp4",
      });
    } catch (cause) {
      setRecording(false);
      showToast(
        cause instanceof Error ? cause.message : "Enregistrement impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  function renderMode({ item, index }: ListRenderItemInfo<ModeItem>) {
    return (
      <ModeLabel
        item={item}
        index={index}
        scrollX={scrollX}
        selected={item.id === modeId}
        onPress={() => selectMode(item.id, index)}
      />
    );
  }

  if (!permission) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.center, { padding: 24 }]}>
        <Text style={styles.permTitle}>Caméra requise</Text>
        <Text style={styles.permSub}>
          Autorise la caméra pour photo et vidéo style Stories.
        </Text>
        <Pressable
          style={styles.permBtn}
          onPress={() => void requestPermission()}
        >
          <Text style={styles.permBtnText}>Autoriser</Text>
        </Pressable>
        <Pressable onPress={onClose} style={{ marginTop: 16 }}>
          <Text style={styles.permSub}>Fermer</Text>
        </Pressable>
      </View>
    );
  }

  const cameraMode = activeMode.kind === "video" ? "video" : "picture";

  return (
    <View style={styles.root}>
      <CameraView
        key={`${cameraMode}-${facing}`}
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode={cameraMode}
        mirror={facing === "front"}
        mute={false}
        onCameraReady={() => setCameraReady(true)}
        onMountError={() => {
          setCameraReady(false);
          showToast("Ouverture caméra impossible sur cet appareil", "error");
        }}
      />

      {filterId !== "none" ? (
        <LiveFilterOverlay look={filterId} pose={pose} />
      ) : null}

      <View
        pointerEvents="box-none"
        style={[styles.overlay, { paddingTop: insets.top + 6 }]}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={onClose}
            style={styles.iconHit}
            accessibilityLabel="Fermer"
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
          <Pressable
            style={styles.soundPill}
            onPress={onOpenSound}
            accessibilityLabel="Ajouter un son"
          >
            <Ionicons name="musical-notes" size={14} color="#FFFFFF" />
            <Text style={styles.soundText}>Ajouter un son</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setCameraReady(false);
              setFacing((f) => (f === "front" ? "back" : "front"));
            }}
            style={styles.iconHit}
            accessibilityLabel="Retourner la caméra"
          >
            <Ionicons name="camera-reverse-outline" size={26} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={[styles.rightRail, { top: insets.top + 72 }]}>
          {(
            [
              {
                icon: "sparkles-outline" as const,
                label: "Effets",
                action: () => setFiltersOpen((v) => !v),
              },
              {
                icon: "speedometer-outline" as const,
                label: "Vitesse",
                action: () => showToast("Vitesse bientôt", "info"),
              },
              {
                icon: "grid-outline" as const,
                label: "Grille",
                action: () => showToast("Grille bientôt", "info"),
              },
              {
                icon: "scan-outline" as const,
                label: "Cadre",
                action: () => showToast("Cadre bientôt", "info"),
              },
              {
                icon: "person-add-outline" as const,
                label: "Beauté",
                action: () => {
                  setFiltersOpen(true);
                  setFilterId((id) => (id === "studio" ? "none" : "studio"));
                },
              },
            ] as const
          ).map((tool) => (
            <Pressable
              key={tool.label}
              onPress={tool.action}
              style={styles.railBtn}
              accessibilityLabel={tool.label}
            >
              <Ionicons name={tool.icon} size={22} color="#FFFFFF" />
            </Pressable>
          ))}
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
          {filtersOpen ? (
            <FlatList
              horizontal
              data={CAMERA_FILTERS}
              keyExtractor={(f) => f.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              style={styles.filterList}
              renderItem={({ item }) => {
                const on = item.id === filterId;
                return (
                  <Pressable
                    onPress={() => setFilterId(item.id)}
                    style={[styles.filterChip, on && styles.filterChipOn]}
                  >
                    <Text style={styles.filterEmoji}>{item.emoji}</Text>
                    <Text style={styles.filterName} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </Pressable>
                );
              }}
            />
          ) : null}

          <Animated.FlatList
            ref={listRef}
            horizontal
            data={MODES}
            keyExtractor={(m) => m.id}
            renderItem={renderMode}
            showsHorizontalScrollIndicator={false}
            snapToInterval={MODE_W}
            decelerationRate="fast"
            disableIntervalMomentum
            bounces={false}
            contentContainerStyle={{ paddingHorizontal: MODE_PAD }}
            onScroll={onModeScroll}
            onMomentumScrollEnd={onModeMomentum}
            scrollEventThrottle={16}
            getItemLayout={(_, index) => ({
              length: MODE_W,
              offset: MODE_W * index,
              index,
            })}
            style={styles.modeList}
          />

          <View style={styles.shutterRow}>
            <View style={styles.shutterSide} />
            <Pressable
              onPress={() => void shutter()}
              disabled={(busy && !recording) || !cameraReady}
              style={[
                styles.shutterOuter,
                recording && styles.shutterRec,
                !cameraReady && { opacity: 0.45 },
              ]}
              accessibilityLabel={
                activeMode.kind === "photo" ? "Prendre une photo" : "Filmer"
              }
            >
              <View
                style={[
                  styles.shutterInner,
                  activeMode.kind === "video" && styles.shutterVideo,
                  recording && styles.shutterInnerRec,
                ]}
              />
            </Pressable>
            <View style={styles.shutterSide}>
              {MANNEQUINS.slice(0, 2).map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    setFiltersOpen(true);
                    showToast(`Look ${m.label}`, "info");
                  }}
                  style={styles.mannequinDot}
                >
                  <Image
                    source={m.source}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                </Pressable>
              ))}
            </View>
          </View>

          {recording ? (
            <Text style={styles.recHint}>
              Enregistrement · max {activeMode.duration ?? 60}s — retouche pour
              stop
            </Text>
          ) : (
            <Text style={styles.recHint}>
              Scroll modes · filtres directs · obturateur
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { alignItems: "center", justifyContent: "center" },
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
  soundPill: {
    flex: 1,
    alignSelf: "center",
    maxWidth: 220,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  soundText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  rightRail: {
    position: "absolute",
    right: 8,
    gap: 14,
    alignItems: "center",
  },
  railBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  bottom: { gap: 10, paddingHorizontal: 8 },
  filterList: { flexGrow: 0, maxHeight: 72 },
  filterRow: { gap: 10, paddingHorizontal: 12, alignItems: "center" },
  filterChip: {
    width: 64,
    alignItems: "center",
    gap: 4,
    opacity: 0.75,
  },
  filterChipOn: { opacity: 1 },
  filterEmoji: { fontSize: 22 },
  filterName: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  modeList: { flexGrow: 0, height: 44 },
  modeItem: {
    width: MODE_W,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  modeInner: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    minWidth: 72,
    alignItems: "center",
  },
  modeOn: { backgroundColor: "#FFFFFF" },
  modeText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  modeTextOn: { color: "#111111" },
  shutterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginTop: 4,
  },
  shutterSide: {
    width: 88,
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterRec: { borderColor: "#FF453A" },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#FFFFFF",
  },
  shutterVideo: { borderRadius: 18, width: 54, height: 54 },
  shutterInnerRec: {
    backgroundColor: "#FF453A",
    borderRadius: 10,
    width: 28,
    height: 28,
  },
  mannequinDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "#222",
  },
  recHint: {
    textAlign: "center",
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontWeight: "600",
  },
  permTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  permSub: {
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 20,
  },
  permBtn: {
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  permBtnText: { color: "#111", fontWeight: "800" },
});
