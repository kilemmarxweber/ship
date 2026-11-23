import { IconBackButton } from "@/components/ui/IconBackButton";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { formatMoney } from "@/src/format";
import { REVENUE_SOURCE_LABELS } from "@/src/platform-fees";
import { useSession } from "@/src/session";
import { HAIRLINE } from "@/src/theme";
import { useColors } from "@/src/use-colors";

type Bucket = "day" | "month" | "year";

type SourceRow = {
  source: string;
  grossUsdCents: number;
  providerCostUsdCents: number;
  shipshopNetUsdCents: number;
  partnerShareUsdCents: number;
  count: number;
};

type RevenuePayload = {
  bucket?: Bucket;
  totals?: {
    grossFeeUsdCents: number;
    cinetPayCostUsdCents: number;
    partnerShareUsdCents: number;
    netUsdCents: number;
    inUsdCents: number;
    outUsdCents: number;
  };
  bySource?: SourceRow[];
  series?: {
    key: string;
    label: string;
    shipshopNetUsdCents: number;
    providerCostUsdCents: number;
    partnerShareUsdCents: number;
  }[];
  error?: string;
};

const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "day", label: "Jour" },
  { key: "month", label: "Mois" },
  { key: "year", label: "Année" },
];

function Kpi({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color: string;
}) {
  const c = useColors();
  return (
    <View style={[styles.kpi, { backgroundColor: c.card, borderColor: HAIRLINE }]}>
      <Text style={[styles.kpiLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      {hint ? (
        <Text style={[styles.kpiHint, { color: c.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function PlatformRevenueScreen() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const [bucket, setBucket] = useState<Bucket>("month");

  const q = useQuery({
    queryKey: ["platform-revenue", token ?? "guest", bucket],
    enabled: Boolean(token),
    queryFn: () =>
      api<RevenuePayload>(
        `/api/reports/platform-fees?bucket=${bucket}&period=all`,
      ),
    retry: false,
  });

  const totals = q.data?.totals;
  const sources = q.data?.bySource ?? [];

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
      <IconBackButton color={c.text} />
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.text }]}>
            Bénéfices plateforme
          </Text>
          <Text style={[styles.lead, { color: c.textMuted }]}>
            Entrées ShipShop, coûts CinetPay et parts partenaires
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/shops/admin/fee-settings")}
          style={[styles.linkBtn, { borderColor: HAIRLINE }]}
        >
          <Ionicons name="options-outline" size={18} color={c.primary} />
          <Text style={{ color: c.primary, fontWeight: "700", fontSize: 12 }}>
            Frais
          </Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {BUCKETS.map((item) => {
          const on = bucket === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setBucket(item.key)}
              style={[
                styles.tab,
                {
                  backgroundColor: on ? c.primary : c.card,
                  borderColor: HAIRLINE,
                },
              ]}
            >
              <Text
                style={{
                  color: on ? c.primaryForeground : c.text,
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
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
      ) : q.isError ? (
        <Text style={{ color: c.textMuted, textAlign: "center", padding: 24 }}>
          Accès refusé ou API indisponible.
        </Text>
      ) : (
        <>
          <View style={styles.kpiGrid}>
            <Kpi
              label="Net ShipShop"
              value={formatMoney(totals?.netUsdCents ?? 0, "USD")}
              hint="Après CinetPay"
              color={c.emerald}
            />
            <Kpi
              label="Coût CinetPay"
              value={formatMoney(totals?.cinetPayCostUsdCents ?? 0, "USD")}
              hint="Sortie provider"
              color={c.text}
            />
            <Kpi
              label="Parts partenaires"
              value={formatMoney(totals?.partnerShareUsdCents ?? 0, "USD")}
              hint="Vendeurs / coursiers"
              color={c.text}
            />
            <Kpi
              label="Brut frais"
              value={formatMoney(totals?.grossFeeUsdCents ?? 0, "USD")}
              hint="Entrées fees"
              color={c.text}
            />
          </View>

          <View
            style={[styles.card, { backgroundColor: c.card, borderColor: HAIRLINE }]}
          >
            <Text style={[styles.section, { color: c.text }]}>
              Par source
            </Text>
            {sources.map((row) => (
              <View key={row.source} style={styles.sourceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: "700" }}>
                    {REVENUE_SOURCE_LABELS[row.source] ?? row.source}
                  </Text>
                  <Text style={{ color: c.textMuted, fontSize: 11 }}>
                    {row.count} · brut {formatMoney(row.grossUsdCents, "USD")}
                    {row.providerCostUsdCents > 0
                      ? ` · CinetPay ${formatMoney(row.providerCostUsdCents, "USD")}`
                      : ""}
                    {row.partnerShareUsdCents > 0
                      ? ` · partenaires ${formatMoney(row.partnerShareUsdCents, "USD")}`
                      : ""}
                  </Text>
                </View>
                <Text style={{ color: c.emerald, fontWeight: "800" }}>
                  {formatMoney(row.shipshopNetUsdCents, "USD")}
                </Text>
              </View>
            ))}
          </View>

          {(q.data?.series?.length ?? 0) > 0 ? (
            <View
              style={[
                styles.card,
                { backgroundColor: c.card, borderColor: HAIRLINE },
              ]}
            >
              <Text style={[styles.section, { color: c.text }]}>Série</Text>
              {q.data?.series?.map((point) => (
                <View key={point.key} style={styles.sourceRow}>
                  <Text style={{ color: c.text, flex: 1 }}>{point.label}</Text>
                  <Text style={{ color: c.emerald, fontWeight: "700" }}>
                    {formatMoney(point.shipshopNetUsdCents, "USD")}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  title: { fontSize: 24, fontWeight: "800" },
  lead: { fontSize: 12, marginTop: 4 },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tabs: { flexDirection: "row", gap: 8 },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpi: {
    width: "48%",
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  kpiLabel: { fontSize: 11, fontWeight: "600" },
  kpiValue: { fontSize: 18, fontWeight: "800" },
  kpiHint: { fontSize: 10 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  section: { fontSize: 15, fontWeight: "800" },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  primary: { borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  primaryText: { fontWeight: "800" },
});
