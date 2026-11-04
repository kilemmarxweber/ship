import { Ionicons } from "@expo/vector-icons";
import {
    setAudioModeAsync,
    useAudioPlayer,
    useAudioPlayerStatus,
} from "expo-audio";
import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    api,
    apiDownloadFile,
    apiUpload,
    isVideoUrl,
    mediaUrl,
} from "@/src/api";
import {
    archivePreviewUrl,
    AUDIO_INPUT_MAX_BYTES,
    clampSoundtrackStartMs,
    encodeSlideMotion,
    formatClipClock,
    isAudioLike,
    isVideoLike,
    LOCAL_SOUNDTRACK_ID,
    MONTAGE_MAX_MS,
    MOTION_LABELS,
    parseSlideMotion,
    playableFileUri,
    SLIDE_MOTIONS,
    slideshowWindow,
    VIDEO_INPUT_MAX_BYTES,
    type CatalogTrack,
    type LocalSoundtrackClip,
    type OnlineTrackHit,
    type SlideMotion,
} from "@/src/soundtrack";
import { colors, HAIRLINE, type ThemeColors } from "@/src/theme";
import { showToast } from "@/src/toast";
import { appendUploadFile } from "@/src/upload-file";
import { useColors } from "@/src/use-colors";

async function pickSoundtrackFile() {
  const DocumentPicker = await import("expo-document-picker");
  const result = await DocumentPicker.getDocumentAsync({
    type: ["audio/*", "video/*"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0];
}

const studioStyles = makeStyles(colors);

function ClipPreview({
  uri,
  durationMs,
  startMs,
  onStartMs,
  onDurationMs,
  onPlaying,
  paused,
}: {
  uri: string;
  durationMs: number;
  startMs: number;
  onStartMs: (ms: number) => void;
  onDurationMs?: (ms: number) => void;
  onPlaying?: (playing: boolean) => void;
  paused?: boolean;
}) {
  const c = useColors();
  const styles = studioStyles;
  const player = useAudioPlayer(playableFileUri(uri), {
    updateInterval: 200,
    downloadFirst: true,
  });
  const status = useAudioPlayerStatus(player);
  const barWidth = useRef(1);
  const loadedMs = Math.round((status.duration || 0) * 1000);
  const total = Math.max(1000, loadedMs > 400 ? loadedMs : durationMs);
  const clipMs = Math.min(MONTAGE_MAX_MS, total);
  const maxStart = Math.max(0, total - clipMs);
  const start = clampSoundtrackStartMs(startMs, total);
  const end = start + clipMs;
  const leftPct = (start / total) * 100;
  const widthPct = (clipMs / total) * 100;
  const playheadPct =
    total > 0 ? ((status.currentTime * 1000) / total) * 100 : 0;

  useEffect(() => {
    if (loadedMs > 400) onDurationMs?.(loadedMs);
  }, [loadedMs, onDurationMs]);

  useEffect(() => {
    onPlaying?.(status.playing);
  }, [onPlaying, status.playing]);

  useEffect(() => {
    if (paused && status.playing) player.pause();
  }, [paused, player, status.playing]);

  useEffect(() => {
    if (!status.playing) return;
    const from = start / 1000;
    const to = end / 1000;
    if (status.currentTime >= to - 0.05) {
      void player.seekTo(from);
    }
  }, [end, player, start, status.currentTime, status.playing]);

  function applyStart(next: number) {
    const clamped = clampSoundtrackStartMs(next, total);
    onStartMs(clamped);
    if (status.playing) void player.seekTo(clamped / 1000);
  }

  function seekFromX(x: number) {
    const ratio = Math.max(0, Math.min(1, x / barWidth.current));
    applyStart(ratio * maxStart);
  }

  async function toggle() {
    if (status.playing) {
      player.pause();
      return;
    }
    if (!status.isLoaded) {
      showToast("Chargement du son… patiente une seconde", "info");
    }
    player.volume = 0.8;
    await player.seekTo(start / 1000);
    player.play();
  }

  return (
    <View style={styles.clipBox}>
      <View style={styles.clipHead}>
        <Text style={styles.clipTitle}>Couper l’extrait (1 min)</Text>
        <Text style={styles.clipClock}>
          {formatClipClock(start)} → {formatClipClock(end)}
        </Text>
      </View>
      <Text style={styles.hint}>
        Fais glisser pour choisir la minute jouée. Écoute avant de publier.
      </Text>
      <Pressable
        style={styles.barHit}
        onLayout={(e) => {
          barWidth.current = Math.max(1, e.nativeEvent.layout.width);
        }}
        onPress={(e) => seekFromX(e.nativeEvent.locationX)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderMove={(e) => seekFromX(e.nativeEvent.locationX)}
      >
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barWindow,
              { left: `${leftPct}%`, width: `${widthPct}%` },
            ]}
          />
          <View style={[styles.playhead, { left: `${playheadPct}%` }]} />
        </View>
      </Pressable>
      <View style={styles.cutRow}>
        <Pressable
          style={styles.nudge}
          onPress={() => applyStart(start - 5000)}
          disabled={maxStart <= 0}
        >
          <Text style={styles.nudgeText}>−5 s</Text>
        </Pressable>
        <Text style={styles.cutMeta}>
          {loadedMs > 400
            ? `Piste ${formatClipClock(total)}`
            : "Lecture de la durée…"}
        </Text>
        <Pressable
          style={styles.nudge}
          onPress={() => applyStart(start + 5000)}
          disabled={maxStart <= 0}
        >
          <Text style={styles.nudgeText}>+5 s</Text>
        </Pressable>
      </View>
      <Pressable
        style={[styles.playBtn, !status.isLoaded && { opacity: 0.75 }]}
        onPress={() => void toggle()}
      >
        {!status.isLoaded && !status.playing ? (
          <ActivityIndicator color={c.primaryForeground} />
        ) : (
          <Ionicons
            name={status.playing ? "pause" : "play"}
            size={16}
            color={c.primaryForeground}
          />
        )}
        <Text style={styles.playText}>
          {status.playing
            ? "Pause"
            : status.isLoaded
              ? "Écouter l’extrait"
              : "Chargement du son"}
        </Text>
      </Pressable>
    </View>
  );
}

function HitPreview({ uri }: { uri: string }) {
  const c = useColors();
  const styles = studioStyles;
  const player = useAudioPlayer(uri, {
    updateInterval: 400,
    downloadFirst: true,
  });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!status.isLoaded) return;
    player.volume = 0.8;
    player.play();
  }, [player, status.isLoaded]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        /* released */
      }
    };
  }, [player]);

  return (
    <View style={styles.hitPlay}>
      {status.isLoaded ? (
        <Ionicons name="pause" size={16} color={c.primary} />
      ) : (
        <ActivityIndicator color={c.primary} />
      )}
    </View>
  );
}

function KenImage({
  uri,
  motion,
  slotMs,
}: {
  uri: string;
  motion?: SlideMotion;
  slotMs: number;
}) {
  const styles = studioStyles;
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = 0;
    if (!motion) return;
    t.value = withRepeat(
      withTiming(1, {
        duration: Math.max(800, slotMs),
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
  }, [motion, slotMs, t, uri]);

  const style = useAnimatedStyle(() => {
    if (motion === "zoom-in") {
      return { transform: [{ scale: 1 + t.value * 0.12 }] };
    }
    if (motion === "zoom-out") {
      return { transform: [{ scale: 1.12 - t.value * 0.12 }] };
    }
    if (motion === "pan-left") {
      return {
        transform: [{ scale: 1.12 }, { translateX: 16 - t.value * 32 }],
      };
    }
    if (motion === "pan-right") {
      return {
        transform: [{ scale: 1.12 }, { translateX: t.value * 32 - 16 }],
      };
    }
    if (motion === "pan-up") {
      return {
        transform: [{ scale: 1.12 }, { translateY: 16 - t.value * 32 }],
      };
    }
    return { transform: [{ scale: 1 }] };
  });

  return (
    <Animated.View style={[styles.kenFill, style]}>
      <Image source={{ uri }} style={styles.kenFill} contentFit="cover" />
    </Animated.View>
  );
}

function MontageSlides({
  images,
  motions,
  onMotions,
  playing,
}: {
  images: string[];
  motions: string[];
  onMotions: (next: string[]) => void;
  playing: boolean;
}) {
  const c = useColors();
  const styles = studioStyles;
  const list = images.slice(0, 12);
  const [picked, setPicked] = useState(0);
  const [live, setLive] = useState(0);
  const count = list.length;
  const index = playing ? live : picked;
  const src = list[index] ?? list[0];
  const videoSlide = src ? isVideoUrl(src) : false;
  const motion = videoSlide ? undefined : parseSlideMotion(motions[index]);
  const win = slideshowWindow(index, count);

  useEffect(() => {
    if (!playing || count <= 1) {
      setLive(0);
      return;
    }
    const slot = slideshowWindow(0, count).slot;
    const timer = setInterval(() => {
      setLive((i) => (i + 1) % count);
    }, slot);
    return () => clearInterval(timer);
  }, [playing, count]);

  function cycleMotion(i: number) {
    const url = list[i];
    if (!url || isVideoUrl(url)) return;
    const current = parseSlideMotion(motions[i]);
    const copy = list.map((_, idx) => motions[idx] ?? "");
    if (!current) {
      copy[i] = encodeSlideMotion(SLIDE_MOTIONS[0]!);
    } else {
      const at = SLIDE_MOTIONS.indexOf(current);
      copy[i] =
        at >= SLIDE_MOTIONS.length - 1
          ? ""
          : encodeSlideMotion(SLIDE_MOTIONS[at + 1]!);
    }
    onMotions(copy);
  }

  if (!src) return null;

  return (
    <View style={styles.clipBox}>
      <Text style={styles.clipTitle}>Images sur 1 minute</Text>
      <Text style={styles.hint}>
        Jusqu’à 12 images : elles défilent pendant la minute de son. Choisis le
        mouvement de chaque vue.
      </Text>
      <View style={styles.kenFrame}>
        <KenImage
          uri={mediaUrl(src) ?? src}
          motion={playing ? motion : motion}
          slotMs={win.slot}
        />
        <View style={styles.kenBadge}>
          <Text style={styles.kenBadgeText}>
            {formatClipClock(win.start)} → {formatClipClock(win.end)}
          </Text>
        </View>
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.slideRow}
      >
        {list.map((url, i) => {
          const range = slideshowWindow(i, count);
          const active = i === index;
          return (
            <Pressable
              key={`${url}-${i}`}
              onPress={() => setPicked(i)}
              style={[styles.slideThumb, active && styles.slideThumbOn]}
            >
              <Image
                source={{ uri: mediaUrl(url) ?? url }}
                style={styles.slideImg}
                contentFit="cover"
              />
              <Text style={styles.slideTime}>{formatClipClock(range.end)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable
        style={[styles.importBtn, videoSlide && { opacity: 0.45 }]}
        disabled={videoSlide}
        onPress={() => cycleMotion(index)}
      >
        <Ionicons name="sparkles-outline" size={16} color={c.text} />
        <Text style={styles.importText}>
          Animation : {videoSlide ? "—" : motion ? MOTION_LABELS[motion] : "—"}
        </Text>
      </Pressable>
    </View>
  );
}

export function MusicStudio({
  productTitle,
  images,
  soundtrackId,
  onSoundtrackId,
  startMs,
  onStartMs,
  localClip,
  onLocalClip,
  imageMotions,
  onImageMotions,
}: {
  productTitle?: string;
  images: string[];
  soundtrackId: string | null;
  onSoundtrackId: (id: string | null) => void;
  startMs: number;
  onStartMs: (ms: number) => void;
  localClip: LocalSoundtrackClip | null;
  onLocalClip: (clip: LocalSoundtrackClip | null) => void;
  imageMotions: string[];
  onImageMotions: (next: string[]) => void;
}) {
  const c = useColors();
  const styles = studioStyles;
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<OnlineTrackHit[]>([]);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [clipPlaying, setClipPlaying] = useState(false);
  const seeded = useRef(false);

  useEffect(() => {
    if (!open) {
      setPreviewKey(null);
      return;
    }
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
    }).catch(() => undefined);
  }, [open]);

  useEffect(() => {
    void api<{ soundtracks?: CatalogTrack[] }>("/api/soundtracks")
      .then((data) => setTracks(data.soundtracks ?? []))
      .catch(() => setTracks([]));
  }, []);

  useEffect(() => {
    if (seeded.current) return;
    const next = productTitle?.trim() ?? "";
    if (!next) return;
    setSearchQ(next);
    seeded.current = true;
  }, [productTitle]);

  const selectedTrack = useMemo(() => {
    if (soundtrackId === LOCAL_SOUNDTRACK_ID && localClip) {
      return {
        id: LOCAL_SOUNDTRACK_ID,
        title: localClip.title,
        artist: "Temporaire — extrait à la publication",
        durationMs: localClip.durationMs,
        audioUrl: localClip.uri,
      };
    }
    return tracks.find((track) => track.id === soundtrackId) ?? null;
  }, [localClip, soundtrackId, tracks]);

  const previewUri = selectedTrack
    ? playableFileUri(
        mediaUrl(selectedTrack.audioUrl) ?? selectedTrack.audioUrl,
      )
    : null;

  function adoptLocal(clip: LocalSoundtrackClip) {
    setPreviewKey(null);
    onLocalClip(clip);
    onSoundtrackId(LOCAL_SOUNDTRACK_ID);
    onStartMs(0);
  }

  async function searchOnline() {
    const q = searchQ.trim() || productTitle?.trim() || "";
    if (q.length < 2) {
      showToast("Indique un titre ou un style (ex. rumba, jazz)", "error");
      return;
    }
    setSearching(true);
    setPreviewKey(null);
    try {
      const data = await api<{ tracks?: OnlineTrackHit[]; error?: string }>(
        `/api/soundtracks/search?q=${encodeURIComponent(q)}`,
      );
      const found = data.tracks ?? [];
      setHits(found);
      if (!found.length) {
        showToast("Aucun son libre trouvé — essaie un autre titre", "info");
      }
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Recherche impossible",
        "error",
      );
    } finally {
      setSearching(false);
    }
  }

  async function useOnlineHit(hit: OnlineTrackHit) {
    setFetchingId(hit.identifier);
    setPreviewKey(null);
    try {
      const ext = hit.file.includes(".")
        ? (hit.file.split(".").pop() ?? "mp3")
        : "mp3";
      const fileName = `ia-${hit.identifier.slice(0, 24)}.${ext}`;
      const downloaded = await apiDownloadFile(
        `/api/soundtracks/fetch?identifier=${encodeURIComponent(hit.identifier)}&file=${encodeURIComponent(hit.file)}`,
        fileName,
      );
      adoptLocal({
        uri: downloaded.uri,
        title: hit.title,
        fileName,
        mimeType: downloaded.mimeType,
        durationMs: MONTAGE_MAX_MS,
      });
      showToast("Son importé — coupe la minute voulue", "success");
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Téléchargement impossible",
        "error",
      );
    } finally {
      setFetchingId(null);
    }
  }

  async function importFromDevice() {
    setImporting(true);
    try {
      const asset = await pickSoundtrackFile();
      if (!asset) return;
      const name = asset.name ?? "import";
      const mime = asset.mimeType ?? null;
      const video = isVideoLike(name, mime);
      const audio = isAudioLike(name, mime);
      if (!video && !audio) {
        throw new Error(
          "Importe une musique (MP3, M4A…) ou une vidéo (MP4, MOV…)",
        );
      }
      const maxBytes = video ? VIDEO_INPUT_MAX_BYTES : AUDIO_INPUT_MAX_BYTES;
      if ((asset.size ?? 0) > maxBytes) {
        throw new Error(
          video
            ? "Vidéo trop lourde (max 100 Mo)"
            : "Fichier audio trop lourd (max 25 Mo)",
        );
      }
      adoptLocal({
        uri: playableFileUri(asset.uri),
        title:
          name
            .replace(/\.[^.]+$/, "")
            .trim()
            .slice(0, 80) || "Import",
        fileName: name,
        mimeType: mime || (video ? "video/mp4" : "audio/mpeg"),
        durationMs: MONTAGE_MAX_MS,
      });
      showToast("Son importé — coupe la minute voulue", "success");
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Import impossible",
        "error",
      );
    } finally {
      setImporting(false);
    }
  }

  function pickCatalog(track: CatalogTrack) {
    setPreviewKey(null);
    if (soundtrackId === track.id) {
      onLocalClip(null);
      onSoundtrackId(null);
      onStartMs(0);
      return;
    }
    onLocalClip(null);
    onSoundtrackId(track.id);
    onStartMs(0);
  }

  function toggleLocal() {
    if (!localClip) return;
    setPreviewKey(null);
    if (soundtrackId === LOCAL_SOUNDTRACK_ID) {
      onSoundtrackId(null);
      onStartMs(0);
      return;
    }
    onSoundtrackId(LOCAL_SOUNDTRACK_ID);
    onStartMs(0);
  }

  return (
    <>
      <Pressable style={styles.entry} onPress={() => setOpen(true)}>
        <View style={styles.entryIcon}>
          <Ionicons name="musical-notes" size={18} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.entryTitle}>Studio musique</Text>
          <Text style={styles.entrySub} numberOfLines={1}>
            {selectedTrack
              ? selectedTrack.title
              : "Son, coupe 1 min et animations"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.frame}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.handle} />
            <View style={styles.head}>
              <View style={styles.entryIcon}>
                <Ionicons name="disc" size={18} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Studio musique</Text>
                <Text style={styles.hint}>
                  Écoute, coupe 1 minute, anime tes images
                </Text>
              </View>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={20} color={c.text} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
              contentContainerStyle={styles.body}
            >
              <View style={styles.searchCard}>
                <View style={styles.searchHead}>
                  <View style={styles.globe}>
                    <Ionicons
                      name="globe-outline"
                      size={18}
                      color={c.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryTitle}>
                      Trouver un son en ligne
                    </Text>
                    <Text style={styles.hint}>
                      Fais défiler les résultats, écoute, puis utilise le son.
                    </Text>
                  </View>
                </View>
                <View style={styles.searchRow}>
                  <TextInput
                    value={searchQ}
                    onChangeText={setSearchQ}
                    placeholder="Ex. rumba, jazz, actualités…"
                    placeholderTextColor={c.textMuted}
                    style={styles.searchInput}
                    returnKeyType="search"
                    onSubmitEditing={() => void searchOnline()}
                  />
                  <Pressable
                    style={styles.searchBtn}
                    disabled={searching}
                    onPress={() => void searchOnline()}
                  >
                    {searching ? (
                      <ActivityIndicator color={c.primaryForeground} />
                    ) : (
                      <Ionicons
                        name="search"
                        size={16}
                        color={c.primaryForeground}
                      />
                    )}
                    <Text style={styles.searchBtnText}>
                      {searching ? "…" : "Chercher"}
                    </Text>
                  </Pressable>
                </View>
                {hits.length > 0 ? (
                  <ScrollView
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    style={styles.hits}
                    contentContainerStyle={styles.hitsInner}
                    showsVerticalScrollIndicator
                    persistentScrollbar={Platform.OS === "android"}
                  >
                    {hits.map((hit) => {
                      const key = `${hit.identifier}-${hit.file}`;
                      const listening = previewKey === key;
                      return (
                        <View key={key} style={styles.hit}>
                          <Pressable
                            style={styles.hitPlay}
                            onPress={() =>
                              setPreviewKey((cur) => (cur === key ? null : key))
                            }
                          >
                            {listening ? (
                              <HitPreview
                                uri={archivePreviewUrl(
                                  hit.identifier,
                                  hit.file,
                                )}
                              />
                            ) : (
                              <Ionicons
                                name="play"
                                size={16}
                                color={c.primary}
                              />
                            )}
                          </Pressable>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.hitTitle} numberOfLines={1}>
                              {hit.title}
                            </Text>
                            <Text style={styles.hitArtist} numberOfLines={1}>
                              {hit.artist}
                            </Text>
                          </View>
                          <Pressable
                            disabled={fetchingId === hit.identifier}
                            onPress={() => void useOnlineHit(hit)}
                            hitSlop={8}
                          >
                            {fetchingId === hit.identifier ? (
                              <ActivityIndicator color={c.primary} />
                            ) : (
                              <Text style={styles.use}>Utiliser</Text>
                            )}
                          </Pressable>
                        </View>
                      );
                    })}
                  </ScrollView>
                ) : null}
              </View>

              <Pressable
                style={styles.importBtn}
                disabled={importing}
                onPress={() => void importFromDevice()}
              >
                {importing ? (
                  <ActivityIndicator color={c.text} />
                ) : (
                  <Ionicons
                    name="cloud-upload-outline"
                    size={16}
                    color={c.text}
                  />
                )}
                <Text style={styles.importText}>
                  {importing ? "Import…" : "Importer musique ou vidéo"}
                </Text>
              </Pressable>

              <View style={styles.chips}>
                {localClip ? (
                  <Pressable
                    onPress={toggleLocal}
                    style={[
                      styles.chip,
                      soundtrackId === LOCAL_SOUNDTRACK_ID && styles.chipOn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        soundtrackId === LOCAL_SOUNDTRACK_ID &&
                          styles.chipTextOn,
                      ]}
                    >
                      {localClip.title}
                    </Text>
                  </Pressable>
                ) : null}
                {tracks.map((track) => (
                  <Pressable
                    key={track.id}
                    onPress={() => pickCatalog(track)}
                    style={[
                      styles.chip,
                      soundtrackId === track.id && styles.chipOn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        soundtrackId === track.id && styles.chipTextOn,
                      ]}
                    >
                      {track.title}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {previewUri && selectedTrack ? (
                <ClipPreview
                  key={`${selectedTrack.id}-${previewUri}`}
                  uri={previewUri}
                  durationMs={selectedTrack.durationMs}
                  startMs={startMs}
                  onStartMs={onStartMs}
                  paused={Boolean(previewKey)}
                  onPlaying={setClipPlaying}
                  onDurationMs={(ms) => {
                    if (
                      soundtrackId === LOCAL_SOUNDTRACK_ID &&
                      localClip &&
                      Math.abs(localClip.durationMs - ms) > 400
                    ) {
                      onLocalClip({ ...localClip, durationMs: ms });
                    }
                  }}
                />
              ) : (
                <Text style={styles.hint}>Sans musique — optionnel.</Text>
              )}

              {images.length > 0 ? (
                <MontageSlides
                  images={images}
                  motions={imageMotions}
                  onMotions={onImageMotions}
                  playing={clipPlaying && Boolean(selectedTrack) && !previewKey}
                />
              ) : (
                <Text style={styles.hint}>
                  Ajoute des photos pour choisir les animations du montage.
                </Text>
              )}

              <Pressable style={styles.done} onPress={() => setOpen(false)}>
                <Text style={styles.doneText}>Terminé</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export async function uploadLocalSoundtrack(
  clip: LocalSoundtrackClip,
  startMs: number,
) {
  const form = new FormData();
  appendUploadFile(form, {
    uri: clip.uri,
    fileName: clip.fileName,
    mimeType: clip.mimeType,
  });
  form.append("startMs", String(startMs));
  form.append("title", clip.title);
  const posted = await apiUpload<{ soundtrack?: CatalogTrack; error?: string }>(
    "/api/soundtracks",
    form,
  );
  if (!posted.soundtrack?.id) {
    throw new Error(posted.error ?? "Extrait audio impossible");
  }
  return posted.soundtrack.id;
}

function makeStyles(c: ThemeColors = colors) {
  return StyleSheet.create({
    entry: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 56,
      borderRadius: 16,
      paddingHorizontal: 12,
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HAIRLINE,
    },
    entryIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${c.primary}22`,
    },
    entryTitle: { color: c.text, fontWeight: "800", fontSize: 14 },
    entrySub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    frame: { flex: 1, justifyContent: "flex-end" },
    backdrop: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    sheet: {
      maxHeight: "92%",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: c.sheet,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    handle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 999,
      backgroundColor: HAIRLINE,
      marginBottom: 10,
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 8,
    },
    sheetTitle: { color: c.text, fontWeight: "800", fontSize: 18 },
    body: { gap: 12, paddingBottom: 8 },
    searchCard: {
      borderRadius: 16,
      padding: 12,
      gap: 10,
      backgroundColor: `${c.primary}14`,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.primary}44`,
    },
    searchHead: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    globe: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${c.primary}22`,
    },
    searchRow: { flexDirection: "row", gap: 8 },
    searchInput: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      paddingHorizontal: 12,
      color: c.text,
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HAIRLINE,
    },
    searchBtn: {
      height: 44,
      borderRadius: 12,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: c.primary,
    },
    searchBtnText: {
      color: c.primaryForeground,
      fontWeight: "800",
      fontSize: 13,
    },
    hits: {
      height: 280,
      borderRadius: 12,
      backgroundColor: c.card,
    },
    hitsInner: { paddingVertical: 4, paddingBottom: 12 },
    hit: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "rgba(127,127,140,0.18)",
    },
    hitPlay: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${c.primary}22`,
    },
    hitTitle: { color: c.text, fontWeight: "700", fontSize: 13 },
    hitArtist: { color: c.textMuted, fontSize: 11, marginTop: 1 },
    use: { color: c.primary, fontWeight: "800", fontSize: 12 },
    importBtn: {
      minHeight: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: HAIRLINE,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 12,
    },
    importText: { color: c.text, fontWeight: "700", fontSize: 13 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HAIRLINE,
    },
    chipOn: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { color: c.text, fontWeight: "800", fontSize: 12 },
    chipTextOn: { color: c.primaryForeground },
    hint: { color: c.textMuted, fontSize: 12, lineHeight: 16 },
    clipBox: {
      gap: 8,
      borderRadius: 14,
      padding: 12,
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HAIRLINE,
    },
    clipHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    clipTitle: { color: c.text, fontWeight: "800", fontSize: 13 },
    clipClock: {
      color: c.textMuted,
      fontSize: 11,
      fontVariant: ["tabular-nums"],
    },
    barHit: { minHeight: 44, justifyContent: "center" },
    barTrack: {
      height: 12,
      borderRadius: 999,
      backgroundColor: HAIRLINE,
      overflow: "hidden",
    },
    barWindow: {
      position: "absolute",
      top: 0,
      bottom: 0,
      borderRadius: 999,
      backgroundColor: c.primary,
    },
    playhead: {
      position: "absolute",
      top: -2,
      bottom: -2,
      width: 2,
      marginLeft: -1,
      backgroundColor: "#fff",
    },
    cutRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    nudge: {
      minHeight: 44,
      minWidth: 64,
      paddingHorizontal: 12,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HAIRLINE,
    },
    nudgeText: { color: c.text, fontWeight: "800", fontSize: 13 },
    cutMeta: { color: c.textMuted, fontSize: 12, fontWeight: "700" },
    playBtn: {
      minHeight: 44,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.primary,
    },
    playText: { color: c.primaryForeground, fontWeight: "800" },
    kenFrame: {
      height: 220,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: "#000",
    },
    kenFill: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      width: "100%",
      height: "100%",
    },
    kenBadge: {
      position: "absolute",
      left: 8,
      bottom: 8,
      borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.6)",
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    kenBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
    slideRow: { gap: 8, paddingVertical: 2 },
    slideThumb: {
      width: 52,
      height: 68,
      borderRadius: 8,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.16)",
    },
    slideThumbOn: { borderColor: c.primary, borderWidth: 2 },
    slideImg: { width: 52, height: 68 },
    slideTime: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      textAlign: "center",
      color: "#fff",
      fontSize: 8,
      fontWeight: "700",
      backgroundColor: "rgba(0,0,0,0.65)",
    },
    done: {
      minHeight: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HAIRLINE,
    },
    doneText: { color: c.text, fontWeight: "800", fontSize: 15 },
  });
}
