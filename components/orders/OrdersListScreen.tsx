import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, mediaUrl } from "@/src/api";
import { formatMoney } from "@/src/format";
import { useT } from "@/src/i18n";
import { statusLabel, type OrderListItem } from "@/src/orders";
import { useSession } from "@/src/session";
import { colors } from "@/src/theme";

export function OrdersListScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const [tab, setTab] = useState<"active" | "history">("active");

  const orders = useQuery({
    queryKey: ["orders", tab, token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () =>
      api<{ orders: OrderListItem[] }>(`/api/orders?status=${tab}`),
  });

  const rows = orders.data?.orders ?? [];

  if (!token) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>{t("orders")}</Text>
        <Pressable style={styles.cta} onPress={openAuth}>
          <Text style={styles.ctaText}>Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color="#fff" />
        <Text style={styles.backText} numberOfLines={1}>
          {t("back")}
          {"\u00A0"}
        </Text>
      </Pressable>
      <Text style={styles.title}>{t("orders")}</Text>
      <View style={styles.tabs}>
        {(
          [
            ["active", t("ordersActive")],
            ["history", t("ordersHistory")],
          ] as const
        ).map(([key, label]) => {
          const on = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[styles.tab, on && styles.tabOn]}
            >
              <Text style={[styles.tabText, on && styles.tabTextOn]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {orders.isLoading ? (
        <ActivityIndicator color={colors.emerald} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32, gap: 10 }}
          ListEmptyComponent={<Text style={styles.empty}>{t("noOrders")}</Text>}
          renderItem={({ item }) => {
            const cover = mediaUrl(item.product?.images?.[0]);
            const pickup = item.fulfillmentType === "PICKUP";
            return (
              <Pressable
                style={styles.row}
                onPress={() =>
                  router.push({
                    pathname: "/orders/[id]",
                    params: { id: item.id },
                  })
                }
              >
                {cover ? (
                  <Image
                    source={{ uri: cover }}
                    style={styles.thumb}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.thumb} />
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.product?.title ?? t("orders")}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {pickup ? "Retrait" : "Livraison"} ·{" "}
                    {statusLabel(item.status)}
                  </Text>
                </View>
                <Text style={styles.price}>
                  {formatMoney(item.totalCents ?? item.amountCents ?? 0)}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
    paddingRight: 16,
    overflow: "visible",
  },
  backText: {
    color: "#fff",
    fontWeight: "700",
    includeFontPadding: false,
    paddingRight: 12,
    flexShrink: 0,
  },
  title: { color: "#fff", fontSize: 26, fontWeight: "800", marginBottom: 12 },
  tabs: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 4,
    gap: 4,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  tabOn: { backgroundColor: "rgba(255,255,255,0.12)" },
  tabText: {
    color: "rgba(255,255,255,0.62)",
    fontWeight: "800",
    fontSize: 13,
    includeFontPadding: false,
  },
  tabTextOn: { color: "#fff" },
  empty: { color: colors.muted, textAlign: "center", marginTop: 40 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 10,
  },
  thumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: "#222" },
  name: { color: "#fff", fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  price: { color: colors.emerald, fontWeight: "800" },
  cta: {
    backgroundColor: colors.emerald,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ctaText: { color: "#04281c", fontWeight: "800" },
});
