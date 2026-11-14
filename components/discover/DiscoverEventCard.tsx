import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { mediaUrl } from "@/src/api";
import { eventPosterTone, eventPosterUrl } from "@/src/event-poster";
import type { PublicEvent } from "@/src/tickets";

function formatWhen(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function DiscoverEventCard({
  event,
  width,
  height,
  priceLabel,
  onPress,
}: {
  event: PublicEvent;
  width: number;
  height: number;
  priceLabel?: string | null;
  onPress: () => void;
}) {
  const uri =
    mediaUrl(eventPosterUrl(event.imageUrl, event.id)) ??
    eventPosterUrl(event.imageUrl, event.id);
  const tone = eventPosterTone(event.id);
  const when = formatWhen(event.startsAt);
  const place = [event.venue, event.city].filter(Boolean).join(" · ");
  const badge =
    event.organizerKind === "ORGANIZATION" ? "CONCERT" : "ÉVÉNEMENT";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.root,
        { width, height },
        pressed && { opacity: 0.94, transform: [{ scale: 0.985 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Acheter billet ${event.title}`}
    >
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={180}
      />
      <LinearGradient
        colors={[`${tone[0]}66`, "transparent", "rgba(5,8,13,0.55)"]}
        locations={[0, 0.35, 0.7]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["transparent", "rgba(5,8,13,0.55)", "rgba(5,8,13,0.96)"]}
        locations={[0.28, 0.58, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.badge}>
        <Ionicons name="ticket" size={12} color="#fff" />
        <Text style={styles.badgeText}>{badge}</Text>
      </View>

      <View style={styles.copy}>
        <Text style={styles.kicker} numberOfLines={1}>
          {event.organizerName || "Organisateur"}
          {when ? ` · ${when}` : ""}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        {place ? (
          <Text style={styles.place} numberOfLines={1}>
            {place}
          </Text>
        ) : null}

        <View style={styles.footer}>
          {priceLabel ? (
            <View style={styles.pricePill}>
              <Text style={styles.priceText}>{priceLabel}</Text>
            </View>
          ) : (
            <View />
          )}
          <LinearGradient
            colors={["#FF7A3D", "#FF5A1F", "#E8460F"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>Acheter billet</Text>
            <Ionicons name="arrow-forward" size={14} color="#fff" />
          </LinearGradient>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#10151F",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  badge: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,90,31,0.95)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  copy: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 24,
    gap: 4,
  },
  kicker: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "700",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  place: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
  },
  pricePill: {
    backgroundColor: "rgba(0,214,165,0.16)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,214,165,0.35)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  priceText: {
    color: "#00D6A5",
    fontSize: 12,
    fontWeight: "800",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
  },
});
