import { Ionicons } from "@expo/vector-icons";
import {
    setAudioModeAsync,
    useAudioPlayer,
    useAudioPlayerStatus,
} from "expo-audio";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { api, isVideoUrl, mediaUrl } from "@/src/api";
import {
    detectImageStyle,
    motionsForModel,
    rankSoundtrack,
    VIDEO_STYLE_MODELS,
    videoStyleModel,
    type ImageStyleId,
} from "@/src/image-style";
import { scanImageTone, tonePhrase } from "@/src/image-tone";
import {
    parseSlideMotion,
    viewerCountry,
    type CatalogTrack,
    type LocalSoundtrackClip,
    type OnlineTrackHit,
} from "@/src/soundtrack";
import { HAIRLINE } from "@/src/theme";
import { useColors } from "@/src/use-colors";
import { Image as ExpoImage } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";

type Props = {
  urls: string[];
  category?: string;
  title?: string;
  currency?: string | null;
  soundtrackId: string | null;
  motions: string[];
  onUseSound: (id: string) => void;
  onUsePreview: (clip: LocalSoundtrackClip) => void;
  onClearSound: () => void;
  onUseModel: (motions: string[]) => void;
  onCategory?: (category: string) => void;
};

const STYLE_IDS = new Set<ImageStyleId>([
  "mode",
  "beaute",
  "tech",
  "aliment",
  "maison",
  "sport",
  "lifestyle",
  "auto",
  "neutre",
]);

type CatalogRead = {
  category: string;
  known?: boolean;
  style: string;
  soundQuery: string;
  modelId: string;
};

function isStyleId(value: string): value is ImageStyleId {
  return STYLE_IDS.has(value as ImageStyleId);
}

function firstStill(urls: string[]) {
  return urls.find(
    (url) =>
      !/\.(mp4|webm|mov|m4v|mkv|avi|3gp)$/i.test(url.split("?")[0] ?? url),
  );
}

function StreamPreview({ uri, startMs }: { uri: string; startMs: number }) {
  const player = useAudioPlayer(uri, { downloadFirst: false });
  const status = useAudioPlayerStatus(player);
  const started = useRef(false);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
    }).catch(() => undefined);
  }, []);

  // Expo Audio exposes player controls as mutable properties.
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => {
    if (started.current || !status.isLoaded) return;
    started.current = true;
    // eslint-disable-next-line react-hooks/immutability
    player.volume = 0.85;
    void player.seekTo(Math.max(0, startMs) / 1000);
    player.play();
  }, [player, startMs, status.isLoaded]);

  return null;
}

/** 1re ou 4e piste, une fois la liste chargée. */
function autoPickIndex(count: number) {
  if (count <= 1) return 0;
  if (count >= 4) return Math.random() < 0.5 ? 0 : 3;
  return Math.floor(Math.random() * count);
}

function ExcerptVideo({ uri }: { uri: string }) {
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
      contentFit="cover"
      nativeControls={false}
    />
  );
}

function ExcerptStill({
  uri,
  motion,
}: {
  uri: string;
  motion?: ReturnType<typeof parseSlideMotion>;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [t, uri]);
  const style = useAnimatedStyle(() => {
    if (motion === "zoom-out") {
      return { transform: [{ scale: 1.12 - t.value * 0.12 }] };
    }
    if (motion === "pan-left") {
      return {
        transform: [{ scale: 1.08 }, { translateX: 12 - t.value * 24 }],
      };
    }
    if (motion === "pan-right") {
      return {
        transform: [{ scale: 1.08 }, { translateX: t.value * 24 - 12 }],
      };
    }
    return { transform: [{ scale: 1 + t.value * 0.1 }] };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <ExpoImage
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
    </Animated.View>
  );
}

export function ImageStyleProposal({
  urls,
  category,
  title,
  currency,
  soundtrackId,
  motions,
  onUseSound,
  onUsePreview,
  onClearSound,
  onUseModel,
  onCategory,
}: Props) {
  const c = useColors();
  const [ratio, setRatio] = useState<number | undefined>();
  const [measuredStill, setMeasuredStill] = useState<string | null>(null);
  const [tracks, setTracks] = useState<CatalogTrack[] | null>(null);
  const [picks, setPicks] = useState<OnlineTrackHit[]>([]);
  const [pickIndex, setPickIndex] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [loadedFor, setLoadedFor] = useState("");
  const [toneBit, setToneBit] = useState("");
  const [toneFor, setToneFor] = useState<string | null>(null);
  const [replay, setReplay] = useState(0);
  const [moreBusy, setMoreBusy] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [montageOn, setMontageOn] = useState(false);
  const pageRef = useRef(1);
  const onUsePreviewRef = useRef(onUsePreview);
  const onUseModelRef = useRef(onUseModel);
  const onUseSoundRef = useRef(onUseSound);
  const onClearSoundRef = useRef(onClearSound);
  const onCategoryRef = useRef(onCategory);
  const [detected, setDetected] = useState<{
    url: string;
    hit: CatalogRead;
  } | null>(null);
  const [gaveUp, setGaveUp] = useState<string | null>(null);
  const still = firstStill(urls);
  const target = still ?? urls[0] ?? "";
  const catalog = detected?.url === target ? detected.hit : null;
  const forcedStyle =
    catalog && isStyleId(catalog.style) ? catalog.style : undefined;
  const ratioReady = !still || measuredStill === still;
  const detectReady = !target || Boolean(catalog) || gaveUp === target;

  useEffect(() => {
    if (!still) return;
    let alive = true;
    Image.getSize(
      still,
      (width, height) => {
        if (!alive) return;
        setRatio(width > 0 && height > 0 ? width / height : undefined);
        setMeasuredStill(still);
      },
      () => {
        if (!alive) return;
        setRatio(undefined);
        setMeasuredStill(still);
      },
    );
    return () => {
      alive = false;
    };
  }, [still]);

  useEffect(() => {
    if (!still) return;
    let alive = true;
    const finish = (phrase: string) => {
      if (!alive) return;
      setToneBit(phrase);
      setToneFor(still);
    };
    const timer = setTimeout(() => finish(""), 4000);
    void scanImageTone(mediaUrl(still) ?? still).then((tone) => {
      clearTimeout(timer);
      finish(tone ? tonePhrase(tone) : "");
    });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [still]);

  useEffect(() => {
    let alive = true;
    void api<{ soundtracks?: CatalogTrack[] }>("/api/soundtracks")
      .then((data) => {
        if (alive) setTracks(data.soundtracks ?? []);
      })
      .catch(() => {
        if (alive) setTracks([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    onUsePreviewRef.current = onUsePreview;
    onUseModelRef.current = onUseModel;
    onUseSoundRef.current = onUseSound;
    onClearSoundRef.current = onClearSound;
    onCategoryRef.current = onCategory;
  }, [onCategory, onClearSound, onUseModel, onUsePreview, onUseSound]);

  useEffect(() => {
    if (!target) return;
    let alive = true;
    const timer = setTimeout(() => {
      if (alive) setGaveUp(target);
    }, 2200);
    void api<CatalogRead>("/api/catalog/classify", {
      method: "POST",
      body: JSON.stringify({ url: target }),
    })
      .then((hit) => {
        if (!alive || !hit?.category || !hit.style) return;
        clearTimeout(timer);
        setDetected({ url: target, hit });
        onCategoryRef.current?.(hit.category);
      })
      .catch(() => {
        if (alive) setGaveUp(target);
      });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [target]);

  const read = detectImageStyle({
    urls,
    category: catalog?.category ?? category,
    title,
    ratio,
    style: forcedStyle,
  });
  const signature = read?.signature ?? "";
  const soundQuery = catalog?.soundQuery
    ? catalog.soundQuery
    : [read?.soundQuery ?? "", toneBit].filter(Boolean).join(" ");
  const soundMood = read?.soundMood ?? "";
  const modelId = catalog?.modelId ?? read?.modelId;
  const track = read && tracks ? rankSoundtrack(tracks, read.soundMood) : null;
  const activeModel = montageOn
    ? (modelMatching(urls, motions) ?? modelId ?? null)
    : null;
  const online = picks[pickIndex] ?? null;
  const toneReady = !still || toneFor === still || Boolean(catalog);
  const loadingSound =
    Boolean(signature) && ratioReady && detectReady && loadedFor !== signature;
  const soundStartMs = still ? 0 : (online?.hookMs ?? 0);
  const appliedMontage = useRef(false);

  useEffect(() => {
    if (!urls.length) return;
    if (!montageOn) {
      if (!appliedMontage.current) return;
      appliedMontage.current = false;
      onUseModelRef.current(urls.map(() => ""));
      return;
    }
    if (appliedMontage.current || !modelId) return;
    appliedMontage.current = true;
    onUseModelRef.current(motionsForModel(urls, videoStyleModel(modelId)));
  }, [modelId, montageOn, urls]);

  useEffect(() => {
    if (!signature || !ratioReady || !toneReady || !detectReady) return;
    let alive = true;
    pageRef.current = 1;
    void (async () => {
      const country = viewerCountry(currency);
      let hits: OnlineTrackHit[] = [];
      try {
        const data = await api<{ tracks?: OnlineTrackHit[] }>(
          `/api/soundtracks/suggest?q=${encodeURIComponent(soundQuery)}&country=${encodeURIComponent(country)}`,
        );
        hits = (data.tracks ?? []).filter((item) => item.previewUrl);
      } catch {
        hits = [];
      }
      if (!alive) return;
      const index = autoPickIndex(hits.length);
      setPicks(hits);
      setPickIndex(index);
      setPinned(hits.length > 0);
      setLoadedFor(signature);
      if (!hits.length && tracks && soundOn) {
        const suggestion = rankSoundtrack(tracks, soundMood);
        if (suggestion) onUseSoundRef.current(suggestion.id);
      }
    })();
    return () => {
      alive = false;
    };
  }, [
    currency,
    detectReady,
    ratioReady,
    signature,
    soundMood,
    soundQuery,
    toneReady,
    tracks,
  ]);

  useEffect(() => {
    if (pinned || picks.length < 2) return;
    const timer = setInterval(() => {
      setPickIndex((current) => (current + 1) % picks.length);
    }, 20_000);
    return () => clearInterval(timer);
  }, [picks.length, pinned]);

  useEffect(() => {
    if (loadedFor !== signature) return;
    if (!soundOn) {
      onClearSoundRef.current();
      return;
    }
    const hit = picks[pickIndex];
    if (!hit?.previewUrl) {
      if (track) onUseSoundRef.current(track.id);
      return;
    }
    onUsePreviewRef.current({
      uri: hit.previewUrl,
      title: hit.title,
      artist: hit.artist,
      fileName: hit.file,
      mimeType: "audio/mpeg",
      durationMs: 60_000,
      hookMs: still ? 0 : (hit.hookMs ?? 0),
      remote: { identifier: hit.identifier, file: hit.file },
    });
  }, [loadedFor, pickIndex, picks, signature, soundOn, still, track]);

  if (!read) return null;

  return (
    <View
      style={[styles.card, { backgroundColor: c.card, borderColor: HAIRLINE }]}
    >
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: `${c.primary}22` }]}>
          <Ionicons name="color-wand-outline" size={18} color={c.primary} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: c.text }]}>
            {catalog?.category ?? read.label}
          </Text>
          <Text style={[styles.sub, { color: c.textMuted }]} numberOfLines={2}>
            {read.detail}
            {read.stillCount > 1
              ? " · les photos s’enchaînent en un seul produit"
              : ""}
            {read.videoCount > 0 ? " · la vidéo reste filmée" : ""}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Proposer d’autres sons"
          disabled={loadingSound || moreBusy || !signature}
          hitSlop={4}
          onPress={() => {
            if (!signature) return;
            const nextPage = pageRef.current + 1;
            pageRef.current = nextPage;
            const skip = picks.map((item) => item.identifier).join(",");
            setMoreBusy(true);
            void (async () => {
              try {
                const country = viewerCountry(currency);
                const data = await api<{ tracks?: OnlineTrackHit[] }>(
                  `/api/soundtracks/suggest?q=${encodeURIComponent(soundQuery)}&country=${encodeURIComponent(country)}&page=${nextPage}&skip=${encodeURIComponent(skip)}`,
                );
                const hits = (data.tracks ?? []).filter(
                  (item) => item.previewUrl,
                );
                if (!hits.length) return;
                const index = autoPickIndex(hits.length);
                setPicks(hits);
                setPickIndex(index);
                setPinned(true);
                setReplay((token) => token + 1);
              } catch {
                pageRef.current = Math.max(1, nextPage - 1);
              } finally {
                setMoreBusy(false);
              }
            })();
          }}
          style={styles.more}
        >
          {moreBusy ? (
            <ActivityIndicator color={c.primary} />
          ) : (
            <Ionicons name="shuffle" size={22} color={c.text} />
          )}
        </Pressable>
      </View>

      {loadingSound ? (
        <View
          style={[styles.sound, { borderColor: HAIRLINE }]}
          accessibilityRole="progressbar"
          accessibilityLabel="Recherche du son"
        >
          <ActivityIndicator color={c.primary} />
          <Text style={[styles.soundTitle, { color: c.text }]}>
            Recherche du son pour cette image…
          </Text>
        </View>
      ) : (
        <>
          {soundOn && online?.previewUrl ? (
            <StreamPreview
              key={`${online.previewUrl}-${pickIndex}-${replay}`}
              uri={online.previewUrl}
              startMs={soundStartMs}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              online
                ? `Écouter ${online.title}`
                : track
                  ? `Utiliser le son ${track.title}`
                  : "Aucun son du catalogue"
            }
            disabled={!online && !track}
            onPress={() => {
              if (online?.previewUrl) {
                setPinned(true);
                setReplay((token) => token + 1);
                return;
              }
              if (!track) return;
              onUseSound(track.id);
            }}
            style={[styles.sound, { borderColor: HAIRLINE }]}
          >
            <Ionicons
              name={online ? "play" : "musical-notes"}
              size={18}
              color={c.primary}
            />
            <View style={styles.copy}>
              <Text
                style={[styles.soundTitle, { color: c.text }]}
                numberOfLines={1}
              >
                {online?.title ??
                  (track ? track.title : "Catalogue de sons indisponible")}
              </Text>
              <Text
                style={[styles.sub, { color: c.textMuted }]}
                numberOfLines={1}
              >
                {online
                  ? `${online.artist} · ${pickIndex + 1}/${picks.length}`
                  : track
                    ? soundtrackId === track.id
                      ? "Son proposé, déjà choisi"
                      : `${track.artist} · selon le style`
                    : read.soundQuery}
              </Text>
            </View>
            {pinned || (track && soundtrackId === track.id) ? (
              <Ionicons name="checkmark-circle" size={20} color={c.emerald} />
            ) : null}
          </Pressable>
          {picks.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.models}
            >
              {picks.map((item, index) => {
                const on = index === pickIndex;
                return (
                  <Pressable
                    key={`${item.identifier}-${item.file}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      setSoundOn(true);
                      setPinned(true);
                      setPickIndex(index);
                      setReplay((token) => token + 1);
                    }}
                    style={[
                      styles.pick,
                      {
                        borderColor: on ? c.primary : HAIRLINE,
                        backgroundColor: on ? `${c.primary}18` : c.background,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modelTitle,
                        { color: on ? c.primary : c.text },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </>
      )}

      <View style={styles.choices}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: soundOn && !montageOn }}
          onPress={() => {
            setSoundOn(true);
            setMontageOn(false);
          }}
          style={[
            styles.choice,
            {
              borderColor: soundOn && !montageOn ? c.primary : HAIRLINE,
              backgroundColor:
                soundOn && !montageOn ? `${c.primary}18` : c.background,
            },
          ]}
        >
          <Text
            style={[
              styles.modelTitle,
              { color: soundOn && !montageOn ? c.primary : c.text },
            ]}
          >
            {still ? "Image avec son" : "Avec son"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: montageOn && soundOn }}
          onPress={() => {
            setSoundOn(true);
            setMontageOn(true);
          }}
          style={[
            styles.choice,
            {
              borderColor: montageOn && soundOn ? c.primary : HAIRLINE,
              backgroundColor:
                montageOn && soundOn ? `${c.primary}18` : c.background,
            },
          ]}
        >
          <Text
            style={[
              styles.modelTitle,
              { color: montageOn && soundOn ? c.primary : c.text },
            ]}
          >
            Montage avec son
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: !soundOn }}
          onPress={() => {
            setSoundOn(false);
            setMontageOn(false);
          }}
          style={[
            styles.choice,
            {
              borderColor: !soundOn ? c.primary : HAIRLINE,
              backgroundColor: !soundOn ? `${c.primary}18` : c.background,
            },
          ]}
        >
          <Text
            style={[
              styles.modelTitle,
              { color: !soundOn ? c.primary : c.text },
            ]}
          >
            Sans son
          </Text>
        </Pressable>
      </View>

      {montageOn ? (
        <View style={styles.excerpt}>
          {(() => {
            const clip = urls.find((url) => isVideoUrl(url)) ?? still;
            if (!clip) return null;
            const motion = parseSlideMotion(
              motions[Math.max(0, urls.indexOf(clip))] ?? motions[0],
            );
            return isVideoUrl(clip) ? (
              <ExcerptVideo uri={mediaUrl(clip) ?? clip} />
            ) : (
              <ExcerptStill uri={mediaUrl(clip) ?? clip} motion={motion} />
            );
          })()}
          <Text style={styles.excerptLabel}>
            {soundOn ? "Extrait avec son" : "Extrait sans son"}
          </Text>
        </View>
      ) : null}

      {montageOn ? (
        <>
          <Text style={[styles.modelsLabel, { color: c.text }]}>
            Modèles vidéo
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.models}
          >
            {VIDEO_STYLE_MODELS.map((model) => {
              const on = activeModel === model.id;
              return (
                <Pressable
                  key={model.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    appliedMontage.current = true;
                    setSoundOn(true);
                    setMontageOn(true);
                    onUseModel(motionsForModel(urls, model));
                  }}
                  style={[
                    styles.model,
                    {
                      borderColor: on ? c.primary : HAIRLINE,
                      backgroundColor: on ? `${c.primary}18` : c.background,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.modelTitle,
                      { color: on ? c.primary : c.text },
                    ]}
                  >
                    {model.label}
                  </Text>
                  <Text
                    style={[styles.modelDetail, { color: c.textMuted }]}
                    numberOfLines={2}
                  >
                    {model.detail}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}

function modelMatching(urls: string[], motions: string[]) {
  if (!motions.some(Boolean)) return null;
  for (const model of VIDEO_STYLE_MODELS) {
    const next = motionsForModel(urls, model);
    const same = next.every((value, index) => (motions[index] ?? "") === value);
    if (same) return model.id;
  }
  return null;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, minWidth: 0 },
  more: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "800" },
  sub: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  sound: {
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  soundTitle: { fontSize: 14, fontWeight: "700" },
  use: { fontSize: 14, fontWeight: "800" },
  modelsLabel: { fontSize: 13, fontWeight: "800" },
  models: { gap: 8, paddingRight: 4 },
  model: {
    width: 132,
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
    gap: 4,
  },
  pick: {
    maxWidth: 160,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  excerpt: {
    height: 220,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  excerptLabel: {
    position: "absolute",
    left: 10,
    bottom: 10,
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modelTitle: { fontSize: 14, fontWeight: "800" },
  modelDetail: { fontSize: 12, lineHeight: 16 },
});
