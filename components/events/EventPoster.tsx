import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type ViewStyle,
} from "react-native";

import { mediaUrl } from "@/src/api";
import { eventPosterTone, eventPosterUrl } from "@/src/event-poster";

export function EventPoster({
  eventId,
  imageUrl,
  title,
  organizerName,
  kind,
  style,
  tall,
  compact,
  priceLabel,
  buyLabel,
}: {
  eventId: string;
  imageUrl?: string | null;
  title?: string;
  organizerName?: string;
  kind?: string;
  style?: StyleProp<ViewStyle>;
  tall?: boolean;
  /** Petite vignette (liste billets) */
  compact?: boolean;
  priceLabel?: string | null;
  buyLabel?: string | null;
}) {
  const uri =
    mediaUrl(eventPosterUrl(imageUrl, eventId)) ??
    eventPosterUrl(imageUrl, eventId);
  const tone = eventPosterTone(eventId);
  const letter =
    (title ?? organizerName ?? "E").trim().slice(0, 1).toUpperCase() || "E";

  return (
    <View style={[styles.root, tall && styles.tall, style]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <LinearGradient
        colors={["transparent", "rgba(5,5,10,0.55)", "rgba(5,5,10,0.92)"]}
        locations={[0.25, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[`${tone[0]}55`, "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {kind === "ORGANIZATION" ? "ORG" : "LIVE"}
        </Text>
      </View>
      {priceLabel || buyLabel ? (
        <View style={styles.buyChip}>
          <Text style={styles.buyChipText} numberOfLines={1}>
            {buyLabel}
            {priceLabel ? ` · ${priceLabel}` : ""}
          </Text>
        </View>
      ) : !compact ? (
        <View style={styles.mark}>
          <Text style={styles.letter}>{letter}</Text>
        </View>
      ) : null}
      {title ? (
        <View style={[styles.copy, compact && styles.copyCompact]}>
          <Text
            style={[styles.title, compact && styles.titleCompact]}
            numberOfLines={compact ? 2 : 2}
          >
            {title}
          </Text>
          {organizerName && !compact ? (
            <Text style={styles.meta} numberOfLines={1}>
              {organizerName}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: "#16161F",
    minHeight: 112,
    justifyContent: "flex-end",
  },
  tall: { minHeight: 220, aspectRatio: 16 / 10 },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(255,77,141,0.92)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  mark: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  letter: { color: "#fff", fontWeight: "800", fontSize: 16 },
  buyChip: {
    position: "absolute",
    top: 10,
    right: 10,
    maxWidth: "62%",
    backgroundColor: "rgba(0,133,90,0.95)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  buyChipText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  copy: { padding: 12, gap: 2 },
  copyCompact: { padding: 8 },
  title: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
    includeFontPadding: false,
  },
  titleCompact: { fontSize: 11 },
  meta: { color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: "600" },
});
