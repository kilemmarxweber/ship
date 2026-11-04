import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Linking,
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

type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  kind: "buyer" | "follower" | "invitee" | "self";
  shopName?: string | null;
  productTitles?: string[];
  ordersCount?: number;
  totalSpentCents?: number;
  inviteStatus?: string | null;
};

type Tab = "buyers" | "followers" | "invitees";

export function SellerContactsScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const [tab, setTab] = useState<Tab>("buyers");
  const [shopId, setShopId] = useState("");

  const q = useQuery({
    queryKey: ["shop-contacts", token ?? "guest", shopId],
    enabled: Boolean(token),
    queryFn: () => {
      const params = shopId ? `?shopId=${encodeURIComponent(shopId)}` : "";
      return api<{
        shops?: { id: string; name: string }[];
        buyers?: Contact[];
        followers?: Contact[];
        invitees?: Contact[];
        self?: Contact | null;
      }>(`/api/shops/contacts${params}`);
    },
  });

  const buyers = q.data?.buyers ?? [];
  const followers = q.data?.followers ?? [];
  const invitees = q.data?.invitees ?? [];
  const list = useMemo(() => {
    if (tab === "buyers") return buyers;
    if (tab === "followers") return followers;
    return invitees;
  }, [tab, buyers, followers, invitees]);
  const paged = usePaged(list, `${tab}-${shopId}-${list.length}`);

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
        <Text style={[styles.title, { color: c.text }]}>
          Contacts boutique
        </Text>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          Acheteurs, abonnés et invitations
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
      ) : q.isLoading ? (
        <ActivityIndicator color={c.primary} />
      ) : (
        <>
          <ShopPicker
            shops={q.data?.shops ?? []}
            value={shopId}
            allLabel="Toutes mes boutiques"
            onChange={setShopId}
          />
          <View style={styles.tabs}>
            {(
              [
                ["buyers", "Acheteurs", buyers.length],
                ["followers", "Abonnés", followers.length],
                ["invitees", "Invités", invitees.length],
              ] as const
            ).map(([key, label, count]) => {
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
                    {label} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {list.length === 0 ? (
            <Text style={{ color: c.textMuted, textAlign: "center", paddingVertical: 28 }}>
              Aucun contact
            </Text>
          ) : (
            <>
              {paged.visible.map((row) => (
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
                    {row.email}
                    {row.phone ? ` · ${row.phone}` : ""}
                  </Text>
                  <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 4 }}>
                    {row.kind === "buyer"
                      ? `${row.ordersCount ?? 0} cmd · ${formatMoney(row.totalSpentCents ?? 0)}`
                      : row.kind === "follower"
                        ? row.shopName
                          ? `Abonné · ${row.shopName}`
                          : "Abonné"
                        : row.inviteStatus ?? "Invité"}
                  </Text>
                  <View style={styles.rowActions}>
                    {row.phone ? (
                      <Pressable onPress={() => void Linking.openURL(`tel:${row.phone}`)}>
                        <Text style={{ color: c.primary, fontWeight: "700", fontSize: 12 }}>
                          Appeler
                        </Text>
                      </Pressable>
                    ) : null}
                    {row.email ? (
                      <Pressable
                        onPress={() => void Linking.openURL(`mailto:${row.email}`)}
                      >
                        <Text style={{ color: c.primary, fontWeight: "700", fontSize: 12 }}>
                          E-mail
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))}
              <PagedMore
                hasMore={paged.hasMore}
                remaining={paged.remaining}
                onMore={paged.more}
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
  lead: { fontSize: 13, marginTop: 4 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderRadius: 10,
    paddingHorizontal: 10,
    minHeight: 36,
    justifyContent: "center",
  },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 2 },
  rowActions: { flexDirection: "row", gap: 14, marginTop: 8 },
  primary: { borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  primaryText: { fontWeight: "800" },
});
