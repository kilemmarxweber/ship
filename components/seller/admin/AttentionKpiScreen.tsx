import { IconBackButton } from "@/components/ui/IconBackButton";
import { useQuery } from "@tanstack/react-query";
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
import { useSession } from "@/src/session";
import { HAIRLINE } from "@/src/theme";
import { useColors } from "@/src/use-colors";

type Guard = {
  value: number;
  status: "ok" | "watch" | "risk";
  threshold: number;
};

type Kpis = {
  periodDays: number;
  attention: {
    avgDwellMs: number;
    sessions7: number;
    sessions30: number;
    retentionJ7: number;
    retentionJ30: number;
  };
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    follows: number;
    interactionRate: number;
    missionCompletionRate: number;
  };
  business: {
    adRevenueCents: number;
    revenuePer1000Sessions: number;
    sponsoredCtr: number;
    postEngagementConversion: number;
    campaignBudgetCents: number;
    giftGmvCents: number;
    giftCount: number;
    orders: number;
  };
  quality: { rejects: number; hideRate: number };
  creators: { activeBadges: number; influencerBadges: number };
  guards: Record<string, Guard>;
};

function pct(n: number) {
  return `${(n * 100).toFixed(1)} %`;
}

export function AttentionKpiScreen() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const q = useQuery({
    queryKey: ["admin-attention", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () => api<{ kpis?: Kpis }>("/api/admin/attention-kpis"),
    retry: false,
  });
  const kpis = q.data?.kpis;

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
      <View>
        <Text style={[styles.title, { color: c.text }]}>KPI attention</Text>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          Attention, engagement, revenus hybrides et garde-fous UX
          {kpis ? ` · ${kpis.periodDays} j` : ""}
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
      ) : q.isError || !kpis ? (
        <Text
          style={{
            color: c.textMuted,
            textAlign: "center",
            paddingVertical: 24,
          }}
        >
          Réservé à l’owner ShipShop.
        </Text>
      ) : (
        <>
          <View style={styles.grid}>
            <Kpi
              label="Dwell moyen"
              value={`${Math.round(kpis.attention.avgDwellMs / 1000)} s`}
              hint="temps / produit"
            />
            <Kpi
              label="Sessions 7 j"
              value={String(kpis.attention.sessions7)}
              hint={`${kpis.attention.sessions30} / 30 j`}
            />
            <Kpi
              label="Rétention J7"
              value={pct(kpis.attention.retentionJ7)}
              hint={`J30 ${pct(kpis.attention.retentionJ30)}`}
            />
            <Kpi
              label="Interactions"
              value={pct(kpis.engagement.interactionRate)}
              hint={`${kpis.engagement.likes} likes`}
            />
            <Kpi
              label="Rev. pub"
              value={formatMoney(kpis.business.adRevenueCents)}
              hint="18% campagnes + 20% cadeaux"
            />
            <Kpi
              label="ARPS x1000"
              value={formatMoney(kpis.business.revenuePer1000Sessions)}
              hint="revenu / 1k sessions"
            />
            <Kpi
              label="CTR sponsorisé"
              value={pct(kpis.business.sponsoredCtr)}
              hint="clics / impressions"
            />
            <Kpi
              label="Conv. post-eng."
              value={pct(kpis.business.postEngagementConversion)}
              hint={`${kpis.business.orders} cmd`}
            />
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: c.card, borderColor: HAIRLINE },
            ]}
          >
            <Text style={[styles.section, { color: c.text }]}>Garde-fous</Text>
            {Object.entries(kpis.guards).map(([key, guard]) => (
              <View key={key} style={styles.guardRow}>
                <Text
                  style={{
                    color: c.textMuted,
                    textTransform: "capitalize",
                    flex: 1,
                  }}
                >
                  {key}
                </Text>
                <Text
                  style={{
                    color:
                      guard.status === "ok"
                        ? c.emerald
                        : guard.status === "watch"
                          ? "#FBBF24"
                          : "#FF453A",
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {pct(guard.value)} · {guard.status} (seuil{" "}
                  {pct(guard.threshold)})
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            <Kpi
              label="Badge Actif"
              value={String(kpis.creators.activeBadges)}
              hint="comptes motivés"
            />
            <Kpi
              label="Influenceurs"
              value={String(kpis.creators.influencerBadges)}
              hint="2k+ abonnés"
            />
            <Kpi
              label="Cadeaux"
              value={formatMoney(kpis.business.giftGmvCents)}
              hint={`${kpis.business.giftCount} envois`}
            />
            <Kpi
              label="Missions"
              value={pct(kpis.engagement.missionCompletionRate)}
              hint="complétion"
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  const c = useColors();
  return (
    <View
      style={[styles.kpi, { backgroundColor: c.card, borderColor: HAIRLINE }]}
    >
      <Text style={{ color: c.text, fontWeight: "800", fontSize: 16 }}>
        {value}
      </Text>
      <Text
        style={{
          color: c.textMuted,
          fontSize: 10,
          fontWeight: "700",
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text style={{ color: c.textMuted, fontSize: 10 }}>{hint}</Text>
    </View>
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
  lead: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpi: {
    width: "48%",
    flexGrow: 1,
    flexBasis: "46%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  section: { fontSize: 14, fontWeight: "800" },
  guardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  primary: { borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  primaryText: { fontWeight: "800" },
});
