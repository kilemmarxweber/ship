import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as SecureStore from "expo-secure-store";
import { router, usePathname } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, mediaUrl } from "@/src/api";
import { formatLiveHostLabel } from "@/src/live-host-label";
import { useMe } from "@/src/me";

const DISMISS_KEY = "ss:live-teaser-dismiss";

type LiveRow = {
  id: string;
  title?: string;
  status?: string;
  hostLabel?: string;
  hostKind?: string;
  shop?: { name?: string; logoUrl?: string | null } | null;
  user: {
    id: string;
    name?: string | null;
    image?: string | null;
  };
};

async function loadDismissed(): Promise<Set<string>> {
  try {
    const raw = await SecureStore.getItemAsync(DISMISS_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

async function persistDismiss(id: string) {
  try {
    const next = await loadDismissed();
    next.add(id);
    await SecureStore.setItemAsync(DISMISS_KEY, JSON.stringify([...next]));
  } catch {
    /* ignore */
  }
}

/**
 * Alerte live feed — visible sans abonnement ; X pour fermer ;
 * masquée si déjà dans ce live.
 */
export function LiveAlertTeaser() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const me = useMe();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const lives = useQuery({
    queryKey: ["lives", "teaser"],
    queryFn: () => api<{ lives: LiveRow[] }>("/api/growth/lives"),
    refetchInterval: 8000,
  });

  useEffect(() => {
    void loadDismissed().then(setDismissed);
  }, []);

  const currentLiveId = pathname?.includes("/live/")
    ? (pathname.split("/live/")[1]?.split(/[/?]/)[0] ?? null)
    : null;

  const pick = useMemo(() => {
    const open = (lives.data?.lives ?? []).filter(
      (row) =>
        row.status !== "ENDED" &&
        !dismissed.has(row.id) &&
        row.user?.id !== me.data?.id &&
        row.id !== currentLiveId,
    );
    if (!open.length) return null;
    const featured = open.find(
      (row) =>
        row.hostKind === "OWNER" ||
        row.hostKind === "ADMIN" ||
        row.hostKind === "INFLUENCER",
    );
    return featured ?? open[0] ?? null;
  }, [lives.data?.lives, dismissed, me.data?.id, currentLiveId]);

  if (!pick || currentLiveId === pick.id) return null;

  const host = formatLiveHostLabel({
    hostLabel: pick.hostLabel,
    userName: pick.user?.name,
    shopName: pick.shop?.name,
  });
  const avatarRaw = pick.user?.image || pick.shop?.logoUrl || null;
  const avatar = avatarRaw ? (mediaUrl(avatarRaw) ?? avatarRaw) : undefined;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + 88 }]}
    >
      <Pressable
        style={styles.card}
        onPress={() =>
          router.push({ pathname: "/live/[id]", params: { id: pick.id } })
        }
      >
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.face} />
        ) : (
          <View style={[styles.face, styles.faceEmpty]}>
            <Ionicons name="radio" size={16} color="#fff" />
          </View>
        )}
        <View style={styles.copy}>
          <View style={styles.row}>
            <View style={styles.livePill}>
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <Text style={styles.host} numberOfLines={1}>
              {host}
            </Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {pick.title || "Live shopping en cours — jette un œil"}
          </Text>
        </View>
        <Text style={styles.cta}>Voir</Text>
      </Pressable>
      <Pressable
        style={styles.close}
        hitSlop={10}
        accessibilityLabel="Fermer l’alerte live"
        onPress={() => {
          void persistDismiss(pick.id);
          setDismissed((prev) => new Set(prev).add(pick.id));
        }}
      >
        <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  card: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(18,8,12,0.94)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(225,29,72,0.45)",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  face: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#222" },
  faceEmpty: { alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  livePill: {
    backgroundColor: "#E11D48",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  host: { flex: 1, color: "#fff", fontWeight: "800", fontSize: 12 },
  title: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600" },
  cta: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 11,
    backgroundColor: "#E11D48",
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
});
