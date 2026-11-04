import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/src/api";
import { formatMoney } from "@/src/format";
import { HAIRLINE } from "@/src/theme";
import { useColors } from "@/src/use-colors";

type Summary = {
  pointsBalance: number;
  sellerTier: string;
  commissionGrantRemaining: number;
  shipCashMonthCents: number;
};

export function ShipRewardsCard({ shopId }: { shopId: string }) {
  const c = useColors();
  const q = useQuery({
    queryKey: ["shiprewards-summary", shopId],
    enabled: Boolean(shopId),
    queryFn: () => api<Summary>(`/api/shiprewards/summary?shopId=${shopId}`),
  });
  const summary = q.data;
  if (!shopId || !summary || typeof summary.pointsBalance !== "number") {
    return null;
  }

  return (
    <View
      style={[styles.card, { backgroundColor: c.card, borderColor: HAIRLINE }]}
    >
      <View style={styles.head}>
        <Text style={[styles.title, { color: c.text }]}>ShipRewards</Text>
        <Pressable
          onPress={() => router.push("/legal/shiprewards" as Href)}
          hitSlop={8}
        >
          <Text style={[styles.help, { color: c.primary }]}>Aide</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        <View style={styles.cell}>
          <Text style={[styles.meta, { color: c.textMuted }]}>Palier</Text>
          <Text style={[styles.value, { color: c.text }]}>
            {summary.sellerTier}
          </Text>
        </View>
        <View style={styles.cell}>
          <Text style={[styles.meta, { color: c.textMuted }]}>ShipPoints</Text>
          <Text style={[styles.value, { color: c.text }]}>
            {summary.pointsBalance}
          </Text>
        </View>
        <View style={styles.cell}>
          <Text style={[styles.meta, { color: c.textMuted }]}>
            ShipCash (mois)
          </Text>
          <Text style={[styles.value, { color: c.text }]}>
            {formatMoney(summary.shipCashMonthCents)}
          </Text>
        </View>
        <View style={styles.cell}>
          <Text style={[styles.meta, { color: c.textMuted }]}>Quota −1 %</Text>
          <Text style={[styles.value, { color: c.text }]}>
            {summary.commissionGrantRemaining} ventes
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 12, fontWeight: "800" },
  help: { fontSize: 11, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { width: "47%", gap: 2 },
  meta: { fontSize: 11 },
  value: { fontSize: 13, fontWeight: "800" },
});
