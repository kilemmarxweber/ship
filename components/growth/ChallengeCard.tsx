import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, type ReactNode } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    View,
    type ViewStyle,
} from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ReelVideo } from "@/components/feed/ReelVideo";
import { isVideoUrl, mediaUrl } from "@/src/api";
import type { ChallengeTemplate } from "@/src/challenge-place";
import { formatMoney } from "@/src/format";
import type { GrowthChallenge } from "@/src/types";

const MOOD: Record<string, string> = {
  Beauté: "💄 Beauté & Bien-être",
  Mode: "👗 Mode & Style",
  Tech: "📱 Tech & Gadgets",
  Maison: "🏡 Maison & Déco",
  Sport: "🏃 Sport & Mouvement",
  Gaming: "🎮 Gaming & Play",
  Auto: "🚗 Auto & Mobilité",
  Livres: "📚 Livres & Culture",
};

type Look = {
  heading: string;
  root: string;
  copyBg: string;
  kicker: string;
  title: string;
  body: string;
  chipBg: string;
  chipFg: string;
  chipIcon: string;
  join: [string, string, string];
  fade: [string, string, string];
  hero: "fill" | "wide" | "cinema" | "inset" | "polaroid";
  overlay: boolean;
  showChip: boolean;
};

const LOOK: Record<ChallengeTemplate, Look> = {
  poster: {
    heading: "🔥 En ce moment",
    root: "#0e0e16",
    copyBg: "transparent",
    kicker: "rgba(255,255,255,0.72)",
    title: "#FFFFFF",
    body: "#F4F4F8",
    chipBg: "#FFFFFF",
    chipFg: "#1A1218",
    chipIcon: "#00855A",
    join: ["#00855A", "#00855A", "#00855A"],
    fade: ["rgba(8,6,12,0)", "rgba(8,6,12,0.72)", "rgba(8,6,12,0.94)"],
    hero: "fill",
    overlay: true,
    showChip: true,
  },
  stack: {
    heading: "🏆 Challenge du jour",
    root: "#0e0e16",
    copyBg: "#0e0e16",
    kicker: "rgba(255,255,255,0.72)",
    title: "#FFFFFF",
    body: "#E8E8F0",
    chipBg: "#FFFFFF",
    chipFg: "#1A1218",
    chipIcon: "#00855A",
    join: ["#00855A", "#00855A", "#00855A"],
    fade: ["rgba(8,8,14,0)", "rgba(8,8,14,0.45)", "#0e0e16"],
    hero: "wide",
    overlay: false,
    showChip: true,
  },
  pulse: {
    heading: "🔥 En ce moment",
    root: "#1a1220",
    copyBg: "#1a1220",
    kicker: "rgba(255,255,255,0.72)",
    title: "#FFFFFF",
    body: "#F0E6EE",
    chipBg: "#FFFFFF",
    chipFg: "#1A1218",
    chipIcon: "#00855A",
    join: ["#00855A", "#00855A", "#00855A"],
    fade: ["rgba(26,18,32,0)", "rgba(26,18,32,0.4)", "#1a1220"],
    hero: "inset",
    overlay: false,
    showChip: true,
  },
  ribbon: {
    heading: "🎯 Mission",
    root: "#121018",
    copyBg: "#121018",
    kicker: "rgba(255,255,255,0.72)",
    title: "#FFFFFF",
    body: "#EDE6F2",
    chipBg: "#FFFFFF",
    chipFg: "#1A1218",
    chipIcon: "#00855A",
    join: ["#00855A", "#00855A", "#00855A"],
    fade: ["rgba(18,16,24,0)", "rgba(18,16,24,0.4)", "#121018"],
    hero: "cinema",
    overlay: false,
    showChip: false,
  },
  split: {
    heading: "🏆 Challenge du jour",
    root: "#161018",
    copyBg: "#161018",
    kicker: "rgba(255,255,255,0.72)",
    title: "#FFFFFF",
    body: "#EDE8F0",
    chipBg: "#FFFFFF",
    chipFg: "#1A1218",
    chipIcon: "#00855A",
    join: ["#00855A", "#00855A", "#00855A"],
    fade: ["rgba(22,16,24,0)", "rgba(22,16,24,0.35)", "#161018"],
    hero: "polaroid",
    overlay: false,
    showChip: true,
  },
};

function coverUris(challenge: GrowthChallenge) {
  const raw = [
    challenge.spotlight?.kind === "image" ? challenge.spotlight.url : null,
    challenge.spotlight?.posterUrl,
    challenge.coverUrl,
    challenge.product?.image,
    ...(challenge.coverCandidates ?? []),
  ].filter((url): url is string => Boolean(url) && !isVideoUrl(url ?? ""));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const uri = mediaUrl(item) ?? item;
    if (!uri) continue;
    const key = uri.split("?")[0]?.toLowerCase() ?? uri;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(uri);
  }
  return out;
}

function Faces({
  challenge,
  compact,
}: {
  challenge: GrowthChallenge;
  compact?: boolean;
}) {
  const faces = challenge.participants ?? [];
  const count = challenge.completions;
  const shown = faces.length ? faces.slice(0, 3) : [{ name: "?", image: null }];
  return (
    <View style={styles.facesRow}>
      <View style={styles.facesStack}>
        {shown.map((face, index) => {
          const uri = mediaUrl(face.image);
          return (
            <View
              key={`${face.name}-${index}`}
              style={[
                styles.face,
                compact && styles.faceSm,
                { marginLeft: index ? -10 : 0, zIndex: 3 - index },
              ]}
            >
              {uri ? (
                <Image
                  source={{ uri }}
                  style={styles.heroImg}
                  contentFit="cover"
                  recyclingKey={`face-${challenge.id}-${index}`}
                  cachePolicy="memory-disk"
                />
              ) : (
                <Text style={styles.faceLetter}>
                  {(face.name || "?").slice(0, 1).toUpperCase()}
                </Text>
              )}
            </View>
          );
        })}
      </View>
      <Text style={styles.facesLabel} numberOfLines={2}>
        {count > 0
          ? `🙌 ${count} ${count > 1 ? "personnes relèvent déjà" : "personne relève déjà"}`
          : "👋 Sois le premier à relever"}
      </Text>
    </View>
  );
}

function HeadingBadge({ look, float }: { look: Look; float?: boolean }) {
  return (
    <View
      style={[
        float ? styles.liveChip : styles.liveChipInline,
        { backgroundColor: look.chipBg },
      ]}
    >
      <Text
        style={[styles.liveChipText, { color: look.chipFg }]}
        numberOfLines={1}
      >
        {look.heading}
      </Text>
    </View>
  );
}

function PulseWrap({
  active,
  fill,
  children,
}: {
  active: boolean;
  fill?: boolean;
  children: ReactNode;
}) {
  const glow = useSharedValue(0.55);
  useEffect(() => {
    if (!active) return;
    glow.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [active, glow]);
  const ring = useAnimatedStyle(() => ({
    opacity: glow.value * 0.55,
    transform: [{ scale: 0.98 + glow.value * 0.025 }],
  }));
  return (
    <View style={fill ? styles.flex : undefined}>
      {active ? <Animated.View style={[styles.pulseRing, ring]} /> : null}
      {children}
    </View>
  );
}

function CoverFallback({ uris }: { uris: string[] }) {
  const [index, setIndex] = useState(0);
  const uri = uris[index];
  if (!uri) {
    return <View style={[styles.heroImg, { backgroundColor: "#121218" }]} />;
  }
  return (
    <Image
      source={{ uri }}
      style={styles.heroImg}
      contentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={uri}
      onError={() => setIndex((value) => value + 1)}
    />
  );
}

function Media({
  video,
  uris,
  playing,
}: {
  video: string | null;
  uris: string[];
  playing: boolean;
}) {
  if (video) return <ReelVideo uri={video} playing={playing} muted loop />;
  return <CoverFallback uris={uris} />;
}

export function ChallengeCard({
  challenge,
  template,
  playing,
  busy,
  compact,
  bottomGutter,
  onJoin,
}: {
  challenge: GrowthChallenge;
  template: ChallengeTemplate;
  playing: boolean;
  busy?: boolean;
  compact?: boolean;
  bottomGutter?: number;
  onJoin: () => void;
}) {
  const insets = useSafeAreaInsets();
  const look = LOOK[template] ?? LOOK.stack;
  const uris = coverUris(challenge);
  const video =
    challenge.spotlight?.kind === "video" && challenge.spotlight.url
      ? (mediaUrl(challenge.spotlight.url) ?? challenge.spotlight.url)
      : null;
  const headerClear = compact ? 0 : insets.top + 52;
  const copyPad = compact
    ? 14
    : Math.max(24, (bottomGutter ?? insets.bottom + 72) + 10);
  const lines = compact ? 2 : look.overlay ? 3 : 4;

  const heroStyle: ViewStyle[] = [
    look.hero === "fill" ? styles.heroFill : styles.hero,
    look.hero === "cinema" && styles.heroCinema,
    look.hero === "polaroid" && styles.heroPolaroid,
    look.hero === "inset" && styles.heroInset,
    compact && look.hero !== "fill" && look.hero !== "cinema"
      ? styles.heroCompact
      : null,
  ].filter(Boolean) as ViewStyle[];

  const copyBlock = (
    <View
      style={[
        look.overlay ? styles.copyOverlay : styles.copy,
        { backgroundColor: look.copyBg, paddingBottom: copyPad },
      ]}
    >
      {template === "ribbon" ? <View style={styles.ribbonBar} /> : null}
      {look.showChip && look.overlay ? <HeadingBadge look={look} /> : null}
      {!look.overlay && !look.showChip ? (
        <Text
          style={[
            styles.kicker,
            { color: look.kicker },
            look.overlay && styles.readShadow,
          ]}
        >
          {look.heading}
        </Text>
      ) : null}
      <Text
        style={[
          styles.kicker,
          { color: look.kicker },
          look.overlay && styles.readShadow,
        ]}
      >
        {MOOD[challenge.category ?? ""] ?? "✨ Lifestyle"} · ✨ à toi de jouer
      </Text>
      <Text
        style={[
          styles.title,
          { color: look.title },
          compact && styles.titleCompact,
          template === "split" && styles.titleScript,
          look.overlay && styles.readShadow,
        ]}
      >
        {challenge.title}
      </Text>
      <Text
        style={[
          styles.body,
          { color: look.body },
          look.overlay && styles.readShadow,
        ]}
        numberOfLines={lines}
      >
        {challenge.body}
      </Text>
      {challenge.event ? (
        <View style={styles.cue}>
          <Text style={styles.chipEmoji}>🎟️</Text>
          <Text style={styles.cueText} numberOfLines={1}>
            Billet · {challenge.event.title}
          </Text>
          {challenge.event.fromPriceCents != null ? (
            <Text style={styles.cuePrice}>
              {formatMoney(
                challenge.event.fromPriceCents,
                challenge.event.currency,
              )}
            </Text>
          ) : null}
        </View>
      ) : challenge.product ? (
        <View style={styles.cue}>
          <Text style={styles.chipEmoji}>🛍️</Text>
          <Text style={styles.cueText} numberOfLines={1}>
            {challenge.product.kind === "teaser"
              ? `Aperçu · ${challenge.product.title}`
              : challenge.product.title}
          </Text>
          {challenge.product.priceCents != null ? (
            <Text style={styles.cuePrice}>
              {formatMoney(
                challenge.product.priceCents,
                challenge.product.currency,
              )}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.footer}>
        <Faces
          challenge={challenge}
          compact={compact || template !== "poster"}
        />
        <Pressable
          disabled={busy || challenge.done}
          onPress={onJoin}
          hitSlop={8}
        >
          <LinearGradient
            colors={
              challenge.done ? ["#2a2a34", "#2a2a34", "#2a2a34"] : look.join
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.join, (busy || challenge.done) && { opacity: 0.7 }]}
          >
            <Text style={styles.joinText}>
              {challenge.done ? "Relevé" : "Je relève"}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );

  const chipOnHero =
    look.showChip && !look.overlay ? <HeadingBadge look={look} float /> : null;

  return (
    <View
      style={[
        styles.root,
        { paddingTop: headerClear, backgroundColor: look.root },
      ]}
    >
      <PulseWrap active={template === "pulse"} fill={look.hero === "fill"}>
        <View style={heroStyle}>
          <View
            style={[
              styles.heroInner,
              look.hero === "polaroid" && styles.heroInnerRound,
              look.hero === "inset" && styles.heroInnerInset,
            ]}
          >
            <Media video={video} uris={uris} playing={playing} />
            <LinearGradient
              colors={look.fade}
              locations={[0.4, 0.72, 1]}
              style={styles.heroFade}
            />
          </View>
          {chipOnHero}
        </View>
      </PulseWrap>
      {copyBlock}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  heroInner: { flex: 1, overflow: "hidden" },
  heroInnerRound: { borderRadius: 12 },
  heroInnerInset: { borderRadius: 28 },
  hero: {
    flexGrow: 0,
    flexShrink: 0,
    width: "100%",
    aspectRatio: 16 / 10,
    overflow: "hidden",
    backgroundColor: "#1a1220",
  },
  heroFill: {
    flex: 1,
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#1a1220",
  },
  heroCinema: { aspectRatio: 21 / 9 },
  heroCompact: { aspectRatio: 4 / 3 },
  heroInset: {
    width: "92%",
    alignSelf: "center",
    marginTop: 8,
    borderRadius: 28,
    aspectRatio: 16 / 10,
  },
  heroPolaroid: {
    width: "90%",
    alignSelf: "center",
    marginTop: 8,
    padding: 8,
    paddingBottom: 18,
    borderRadius: 18,
    backgroundColor: "#f4d0c2",
    aspectRatio: 5 / 4,
  },
  heroImg: { width: "100%", height: "100%" },
  heroFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "58%",
  },
  pulseRing: {
    ...StyleSheet.absoluteFill,
    margin: 4,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(255,79,139,0.55)",
  },
  liveChip: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    zIndex: 2,
    flexShrink: 0,
  },
  liveChipInline: {
    alignSelf: "flex-end",
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexShrink: 0,
  },
  liveChipText: {
    color: "#1A1218",
    fontWeight: "800",
    fontSize: 12,
    flexShrink: 0,
  },
  chipEmoji: { fontSize: 13, lineHeight: 16 },
  readShadow: {
    textShadowColor: "rgba(0,0,0,0.72)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  copy: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 8,
  },
  copyOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
    zIndex: 8,
  },
  ribbonBar: {
    height: 4,
    width: 56,
    borderRadius: 4,
    backgroundColor: "#e0b21a",
    marginBottom: 4,
  },
  kicker: {
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  title: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  titleCompact: { fontSize: 22, lineHeight: 26 },
  titleScript: { fontStyle: "italic", letterSpacing: -0.2 },
  body: {
    color: "#E8E8F0",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  cue: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "rgba(125,255,179,0.12)",
  },
  cueText: { color: "#7dffb3", fontWeight: "700", fontSize: 13, maxWidth: 200 },
  cuePrice: {
    color: "rgba(125,255,179,0.75)",
    fontSize: 12,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 6,
  },
  facesRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  facesStack: { flexDirection: "row", alignItems: "center" },
  face: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#3a3040",
    borderWidth: 2,
    borderColor: "#0e0e16",
    alignItems: "center",
    justifyContent: "center",
  },
  faceSm: { width: 28, height: 28, borderRadius: 14 },
  faceLetter: { color: "#fff", fontWeight: "800", fontSize: 11 },
  facesLabel: {
    color: "#DCDCE8",
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
    fontWeight: "600",
  },
  join: {
    borderRadius: 999,
    paddingHorizontal: 18,
    minHeight: 44,
    paddingVertical: 12,
    justifyContent: "center",
  },
  joinText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
