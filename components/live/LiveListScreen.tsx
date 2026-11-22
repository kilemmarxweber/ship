import { Ionicons } from "@expo/vector-icons";
import { IconBackButton } from "@/components/ui/IconBackButton";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, mediaUrl } from "@/src/api";
import { formatMoney } from "@/src/format";

type LiveRow = {
  id: string;
  title: string;
  status?: string;
  giftCents?: number;
  viewerPeak?: number;
  user: { name?: string | null; image?: string | null };
  product?: { title?: string; images?: string[]; priceCents?: number } | null;
};

export function LiveListScreen() {
  const insets = useSafeAreaInsets();
  const lives = useQuery({
    queryKey: ["lives"],
    queryFn: () => api<{ lives: LiveRow[] }>("/api/growth/lives"),
    refetchInterval: 8000,
  });
  const rows = lives.data?.lives ?? [];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 28,
        paddingHorizontal: 16,
        gap: 10,
      }}
    >
      <IconBackButton color={"#fff"} />
      <Text style={styles.title}>Lives</Text>
      <Pressable
        style={styles.arEntry}
        onPress={() => router.push("/ar" as Href)}
      >
        <Text style={styles.arEmoji}>👑</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.arTitle}>Studio AR</Text>
          <Text style={styles.arBody}>
            Chapeau, lunettes, emojis — teste avant le live
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color="rgba(255,255,255,0.45)"
        />
      </Pressable>
      {lives.isLoading ? (
        <ActivityIndicator color="#00D68F" />
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>Aucun live en cours.</Text>
      ) : (
        rows.map((live) => (
          <Pressable
            key={live.id}
            style={styles.row}
            onPress={() =>
              router.push({ pathname: "/live/[id]", params: { id: live.id } })
            }
          >
            {live.user.image || live.product?.images?.[0] ? (
              <Image
                source={{
                  uri:
                    mediaUrl(live.user.image || live.product?.images?.[0]) ??
                    undefined,
                }}
                style={styles.face}
              />
            ) : (
              <View style={styles.face} />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {live.status === "PAUSED" ? "PAUSE · " : ""}
                {live.title}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {live.user.name ?? "Créateur"}
                {live.product?.title ? ` · ${live.product.title}` : ""}
              </Text>
            </View>
            <Text style={styles.gift}>{formatMoney(live.giftCents ?? 0)}</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0F" },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 16,
  },
  backText: {
    color: "#fff",
    fontWeight: "700",
    includeFontPadding: false,
    paddingRight: 12,
  },
  title: { color: "#fff", fontSize: 26, fontWeight: "800" },
  arEntry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(0,214,143,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,214,143,0.35)",
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
  },
  arEmoji: { fontSize: 28 },
  arTitle: { color: "#fff", fontWeight: "800", fontSize: 15 },
  arBody: { color: "rgba(255,255,255,0.62)", fontSize: 12, marginTop: 2 },
  empty: { color: "rgba(255,255,255,0.62)", marginTop: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 10,
  },
  face: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#222" },
  rowTitle: { color: "#fff", fontWeight: "800" },
  rowMeta: { color: "rgba(255,255,255,0.62)", fontSize: 12, marginTop: 2 },
  gift: { color: "#00D68F", fontWeight: "800", fontSize: 11 },
});
