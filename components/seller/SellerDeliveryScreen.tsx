import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ShopPicker } from "@/components/profile/ShopPicker";
import { PagedMore } from "@/components/ui/PagedMore";
import { api } from "@/src/api";
import { formatMoney } from "@/src/format";
import { useT } from "@/src/i18n";
import { useSession } from "@/src/session";
import { HAIRLINE } from "@/src/theme";
import { usePaged } from "@/src/use-paged";
import { useColors } from "@/src/use-colors";

type Tab = "couriers" | "rates";

type Courier = {
  id: string;
  name: string;
  phone: string;
  address?: string | null;
  isAvailable: boolean;
  zone?: { commune: string } | null;
};

type Rate = {
  id?: string;
  pricingMode: string;
  baseCents: number;
  ratePerKmCents: number;
  flatCents: number | null;
  zone?: { commune: string; name: string } | null;
};

export function SellerDeliveryScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const [shopId, setShopId] = useState("");
  const [tab, setTab] = useState<Tab>("couriers");

  const shopsQ = useQuery({
    queryKey: ["delivery-shops", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () =>
      api<{ shops?: { id: string; name: string; slug: string }[] }>(
        "/api/shops?mine=1",
      ),
  });
  const shops = shopsQ.data?.shops ?? [];
  useEffect(() => {
    if (!shopId && shops[0]?.id) setShopId(shops[0].id);
  }, [shops, shopId]);

  const couriersQ = useQuery({
    queryKey: ["delivery-couriers", token ?? "guest", shopId],
    enabled: Boolean(token && shopId),
    queryFn: () =>
      api<{ couriers?: Courier[] }>(
        `/api/shops/delivery/couriers?shopId=${shopId}`,
      ),
  });
  const ratesQ = useQuery({
    queryKey: ["delivery-rates", token ?? "guest", shopId],
    enabled: Boolean(token && shopId),
    queryFn: () =>
      api<{ rates?: Rate[] }>(`/api/shops/delivery/rates?shopId=${shopId}`),
  });

  const couriers = couriersQ.data?.couriers ?? [];
  const rates = ratesQ.data?.rates ?? [];
  const pagedCouriers = usePaged(couriers, `c-${shopId}-${couriers.length}`);
  const pagedRates = usePaged(rates, `r-${shopId}-${rates.length}`);

  return (
    <ScrollView
      style={[styles.wrap, { backgroundColor: c.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 16,
        gap: 12,
      }}
    >
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Ionicons name="chevron-back" size={20} color={c.text} />
        <Text style={[styles.backText, { color: c.text }]} numberOfLines={1}>
          {t("back")}
          {"\u00A0"}
        </Text>
      </Pressable>
      <View>
        <Text style={[styles.title, { color: c.text }]}>Livraison boutique</Text>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          Livreurs et tarifs de zone
        </Text>
      </View>

      {!token ? (
        <Pressable
          style={[styles.primary, { backgroundColor: c.primary }]}
          onPress={openAuth}
        >
          <Text style={[styles.primaryText, { color: c.primaryForeground }]}>
            Se connecter
          </Text>
        </Pressable>
      ) : (
        <>
          <ShopPicker shops={shops} value={shopId} onChange={setShopId} />
          <View style={styles.tabs}>
            {(
              [
                ["couriers", "Livreurs"],
                ["rates", "Tarifs"],
              ] as const
            ).map(([key, label]) => {
              const on = tab === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setTab(key)}
                  style={[
                    styles.chip,
                    on
                      ? { backgroundColor: c.primary }
                      : { backgroundColor: "rgba(127,127,140,0.14)" },
                  ]}
                >
                  <Text
                    style={{
                      color: on ? c.primaryForeground : c.textMuted,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {!shopId ||
          (tab === "couriers" ? couriersQ.isLoading : ratesQ.isLoading) ? (
            <ActivityIndicator color={c.primary} />
          ) : tab === "couriers" ? (
            <>
              {pagedCouriers.visible.map((row) => (
                <View
                  key={row.id}
                  style={[
                    styles.card,
                    { backgroundColor: c.card, borderColor: HAIRLINE },
                  ]}
                >
                  <Text style={{ color: c.text, fontWeight: "800" }}>
                    {row.name}
                  </Text>
                  <Text style={{ color: c.textMuted, fontSize: 12 }}>
                    {row.phone}
                    {row.address ? ` · ${row.address}` : ""}
                  </Text>
                  <Text
                    style={{
                      color: row.isAvailable ? c.emerald : c.textMuted,
                      fontSize: 11,
                      fontWeight: "700",
                      marginTop: 4,
                    }}
                  >
                    {row.isAvailable ? "Disponible" : "Indisponible"}
                    {row.zone?.commune ? ` · ${row.zone.commune}` : ""}
                  </Text>
                </View>
              ))}
              {couriers.length === 0 ? (
                <Text style={{ color: c.textMuted, textAlign: "center" }}>
                  Aucun livreur
                </Text>
              ) : null}
              <PagedMore
                hasMore={pagedCouriers.hasMore}
                remaining={pagedCouriers.remaining}
                onMore={pagedCouriers.more}
              />
            </>
          ) : (
            <>
              {pagedRates.visible.map((row, index) => (
                <View
                  key={row.id ?? `${row.pricingMode}-${index}`}
                  style={[
                    styles.card,
                    { backgroundColor: c.card, borderColor: HAIRLINE },
                  ]}
                >
                  <Text style={{ color: c.text, fontWeight: "800" }}>
                    {row.zone?.name ?? row.zone?.commune ?? "Tarif"}
                  </Text>
                  <Text style={{ color: c.textMuted, fontSize: 12 }}>
                    {row.pricingMode} · base {formatMoney(row.baseCents)}
                    {row.ratePerKmCents
                      ? ` · ${formatMoney(row.ratePerKmCents)}/km`
                      : ""}
                    {row.flatCents != null
                      ? ` · forfait ${formatMoney(row.flatCents)}`
                      : ""}
                  </Text>
                </View>
              ))}
              {rates.length === 0 ? (
                <Text style={{ color: c.textMuted, textAlign: "center" }}>
                  Aucun tarif
                </Text>
              ) : null}
              <PagedMore
                hasMore={pagedRates.hasMore}
                remaining={pagedRates.remaining}
                onMore={pagedRates.more}
              />
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 16,
  },
  backText: {
    fontWeight: "700",
    includeFontPadding: false,
    paddingRight: 12,
    flexShrink: 0,
  },
  title: { fontSize: 26, fontWeight: "800" },
  lead: { fontSize: 12, marginTop: 4 },
  tabs: { flexDirection: "row", gap: 6 },
  chip: {
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 36,
    justifyContent: "center",
  },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 2 },
  primary: { borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  primaryText: { fontWeight: "800" },
});
