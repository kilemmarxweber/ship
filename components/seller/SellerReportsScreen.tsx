import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import { safeBack } from "@/src/nav";
import { useMemo, useState, type ReactNode } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
    Defs,
    LinearGradient,
    Path,
    Polyline,
    Stop,
} from "react-native-svg";

import { ShopPicker } from "@/components/profile/ShopPicker";
import { PagedMore } from "@/components/ui/PagedMore";
import { api, mediaUrl } from "@/src/api";
import { formatMoney } from "@/src/format";
import { useT } from "@/src/i18n";
import { statusLabel } from "@/src/orders";
import { useSession } from "@/src/session";
import { HAIRLINE } from "@/src/theme";
import { useColors } from "@/src/use-colors";
import { usePaged } from "@/src/use-paged";

type Period = "7d" | "30d" | "90d" | "all";
type Tab = "overview" | "products" | "attention";

type ReportProduct = {
  id: string;
  title: string;
  shopName: string;
  soldQty: number;
  stockQty: number;
  soldCents: number;
  unsoldCents: number;
  image: string | null;
};

type VendorRow = {
  shopId: string;
  shopName: string;
  ownerName: string | null;
  soldCents: number;
  gainCents: number;
  orders: number;
  balanceCents: number;
};

type AttentionOrder = {
  id: string;
  status: string;
  totalCents: number;
  productCents: number;
  product: { title: string; images: string[] };
  shop: { id: string; name: string };
  buyer: { name: string };
};

type Report = {
  role: "owner" | "vendor";
  periodLabel: string;
  shops: { id: string; name: string; slug: string }[];
  summary: {
    soldCents: number;
    gmvCents?: number;
    aovCents?: number;
    takeRateBps?: number;
    vendorGainCents: number;
    platformFeeCents: number;
    cancelledCents: number;
    inProgressCents: number;
    soldCount: number;
    refundedCount: number;
    cancelledCount: number;
  };
  series: {
    date: string;
    label: string;
    revenueCents: number;
    orders: number;
  }[];
  weekdayHeat: { day: string; revenueCents: number; orders: number }[];
  hourHeat: {
    hour: number;
    label: string;
    revenueCents: number;
    orders: number;
  }[];
  insights: {
    peakWeekday: string | null;
    peakWeekdayCents: number;
    peakHour: string | null;
    peakHourCents: number;
    sellThrough: number;
    inventoryValueCents: number;
  };
  funnel?: {
    feed: number;
    product: number;
    purchase: number;
    feedToCardBps: number;
    cardToBuyBps: number;
  };
  wantedIntent?: { category: string; count: number; avgBudgetCents: number }[];
  shopsPro?: boolean;
  products: ReportProduct[];
  vendors: VendorRow[];
  attention: {
    cancelled: AttentionOrder[];
    refunded: AttentionOrder[];
    failed: AttentionOrder[];
    openIssues: {
      id: string;
      orderId: string;
      type: string;
      status: string;
      description: string;
      conversationId: string | null;
      order: {
        totalCents: number;
        product: { title: string };
        shop: { name: string };
        buyer: { name: string };
      };
    }[];
  };
};

type PlatformFees = {
  summary: {
    saleUsdCents: number;
    shippingUsdCents: number;
    withdrawalUsdCents: number;
    totalUsdCents: number;
    saleCount: number;
    shippingCount: number;
  };
  fees: {
    id: string;
    kind: string;
    amountUsdCents: number;
    shopName: string | null;
    courierName: string | null;
  }[];
};

const EMPTY_PRODUCTS: ReportProduct[] = [];
const EMPTY_VENDORS: VendorRow[] = [];
const EMPTY_FEES: PlatformFees["fees"] = [];
const EMPTY_ORDERS: AttentionOrder[] = [];
const EMPTY_ISSUES: Report["attention"]["openIssues"] = [];

const PERIODS: { key: Period; label: string }[] = [
  { key: "7d", label: "7 jours" },
  { key: "30d", label: "30 jours" },
  { key: "90d", label: "90 jours" },
  { key: "all", label: "Tout" },
];

function LineChart({
  series,
  color,
}: {
  series: Report["series"];
  color: string;
}) {
  const w = 320;
  const h = 120;
  const pad = 8;
  if (series.length === 0) {
    return (
      <Text
        style={{
          color: "rgba(127,127,140,1)",
          textAlign: "center",
          paddingVertical: 24,
          fontSize: 12,
        }}
      >
        Pas encore de ventes sur la période
      </Text>
    );
  }
  const max = Math.max(1, ...series.map((row) => row.revenueCents));
  const points = series.map((row, i) => {
    const x =
      pad +
      (series.length <= 1 ? w / 2 : (i / (series.length - 1)) * (w - pad * 2));
    const y = h - pad - (row.revenueCents / max) * (h - pad * 2);
    return { x, y };
  });
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `M ${pad},${h - pad} L ${points.map((p) => `${p.x} ${p.y}`).join(" L ")} L ${w - pad},${h - pad} Z`;
  return (
    <Svg viewBox={`0 0 ${w} ${h}`} width="100%" height={140}>
      <Defs>
        <LinearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#revFill)" />
      <Polyline points={line} fill="none" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export function SellerReportsScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const [period, setPeriod] = useState<Period>("30d");
  const [shopId, setShopId] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  const reportQ = useQuery({
    queryKey: ["seller-reports", token ?? "guest", period, shopId],
    enabled: Boolean(token),
    queryFn: () => {
      const q = new URLSearchParams({ period });
      if (shopId) q.set("shopId", shopId);
      return api<Report>(`/api/reports?${q}`);
    },
  });
  const report = reportQ.data;
  const isOwner = report?.role === "owner";

  const platformQ = useQuery({
    queryKey: ["platform-fees", token ?? "guest", period],
    enabled: Boolean(token && isOwner),
    queryFn: () =>
      api<PlatformFees>(`/api/reports/platform-fees?period=${period}`),
  });

  const weekdayMax = Math.max(
    1,
    ...(report?.weekdayHeat.map((d) => d.revenueCents) ?? [1]),
  );
  const hourBusy = useMemo(() => {
    const hours = report?.hourHeat ?? [];
    const max = Math.max(1, ...hours.map((h) => h.orders));
    return hours
      .filter((h) => h.orders > 0)
      .slice(0, 24)
      .map((h) => ({ ...h, intensity: h.orders / max }));
  }, [report]);

  const products = report?.products ?? EMPTY_PRODUCTS;
  const vendors = report?.vendors ?? EMPTY_VENDORS;
  const fees = platformQ.data?.fees ?? EMPTY_FEES;
  const pagedProducts = usePaged(
    products,
    `${shopId}-${period}-${products.length}`,
  );
  const pagedVendors = usePaged(
    vendors,
    `${shopId}-${period}-v-${vendors.length}`,
  );
  const pagedFees = usePaged(fees, `${period}-f-${fees.length}`, 20);
  const cancelled = report?.attention.cancelled ?? EMPTY_ORDERS;
  const refunded = report?.attention.refunded ?? EMPTY_ORDERS;
  const failed = report?.attention.failed ?? EMPTY_ORDERS;
  const issues = report?.attention.openIssues ?? EMPTY_ISSUES;
  const pagedCancelled = usePaged(cancelled, `c-${period}-${cancelled.length}`);
  const pagedRefunded = usePaged(refunded, `r-${period}-${refunded.length}`);
  const pagedFailed = usePaged(failed, `f-${period}-${failed.length}`);
  const pagedIssues = usePaged(issues, `i-${period}-${issues.length}`);
  const attentionCount =
    cancelled.length + refunded.length + issues.length + failed.length;

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
      <Pressable onPress={() => safeBack()} style={styles.back}>
        <Ionicons name="chevron-back" size={20} color={c.text} />
        <Text style={[styles.backText, { color: c.text }]} numberOfLines={1}>
          {t("back")}
          {"\u00A0"}
        </Text>
      </Pressable>

      <View>
        <Text style={[styles.title, { color: c.text }]}>
          {isOwner ? "Pilot plateforme" : "Mon rapport vendeur"}
        </Text>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          {isOwner
            ? "Tous les vendeurs · CA, gains, soldes et dossiers à traiter"
            : "Vos boutiques · ventes, stock et pics d'achats"}
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
          <View style={styles.tabs}>
            {PERIODS.map((item) => {
              const on = period === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setPeriod(item.key)}
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
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <ShopPicker
            shops={report?.shops ?? []}
            value={shopId}
            allLabel={isOwner ? "Toutes boutiques" : "Toutes mes boutiques"}
            onChange={setShopId}
          />

          {reportQ.isLoading || !report ? (
            <View style={{ paddingVertical: 32 }}>
              {reportQ.isLoading ? (
                <ActivityIndicator color={c.primary} />
              ) : (
                <Text style={{ color: c.textMuted, textAlign: "center" }}>
                  Aucune donnée
                </Text>
              )}
            </View>
          ) : (
            <>
              <View style={styles.kpiGrid}>
                <Kpi
                  icon="trending-up"
                  iconColor={c.primary}
                  label="CA remis"
                  value={formatMoney(report.summary.soldCents)}
                  hint={`${report.summary.soldCount} cmd`}
                />
                <Kpi
                  icon="bar-chart"
                  iconColor={c.emerald}
                  label={isOwner ? "Frais plateforme" : "Gain vendeur"}
                  value={formatMoney(
                    isOwner
                      ? report.summary.platformFeeCents
                      : report.summary.vendorGainCents,
                  )}
                  hint={
                    isOwner
                      ? `Take rate ${((report.summary.takeRateBps ?? 0) / 100).toFixed(1)} %`
                      : "CA − commission ShipShop"
                  }
                />
                <Kpi
                  icon="cube-outline"
                  iconColor="#FBBF24"
                  label={isOwner ? "Stock non vendu" : "Budget stock"}
                  value={formatMoney(report.insights.inventoryValueCents)}
                  hint={
                    isOwner
                      ? `${report.insights.sellThrough}% écoulé`
                      : `${products.reduce((a, p) => a + p.stockQty, 0)} art. · qté × prix`
                  }
                />
                <Kpi
                  icon="wallet-outline"
                  iconColor={c.primary}
                  label="En cours / annulations"
                  value={formatMoney(
                    report.summary.inProgressCents +
                      report.summary.cancelledCents,
                  )}
                  hint={`${report.summary.cancelledCount} annul. · ${report.summary.refundedCount} remb.`}
                />
              </View>

              {isOwner && platformQ.data ? (
                <View
                  style={[
                    styles.card,
                    { backgroundColor: c.card, borderColor: HAIRLINE },
                  ]}
                >
                  <Text style={[styles.section, { color: c.text }]}>
                    Gains ShipShop (ledger)
                  </Text>
                  <View style={styles.kpiGrid}>
                    <Text style={[styles.meta, { color: c.textMuted }]}>
                      Commission ventes × {platformQ.data.summary.saleCount}
                      {"\n"}
                      <Text style={[styles.strong, { color: c.text }]}>
                        {formatMoney(
                          platformQ.data.summary.saleUsdCents,
                          "USD",
                        )}
                      </Text>
                    </Text>
                    <Text style={[styles.meta, { color: c.textMuted }]}>
                      Livraisons 0,50 × {platformQ.data.summary.shippingCount}
                      {"\n"}
                      <Text style={[styles.strong, { color: c.text }]}>
                        {formatMoney(
                          platformQ.data.summary.shippingUsdCents,
                          "USD",
                        )}
                      </Text>
                    </Text>
                    <Text style={[styles.meta, { color: c.textMuted }]}>
                      Retraits 5 %{"\n"}
                      <Text style={[styles.strong, { color: c.text }]}>
                        {formatMoney(
                          platformQ.data.summary.withdrawalUsdCents,
                          "USD",
                        )}
                      </Text>
                    </Text>
                    <Text style={[styles.meta, { color: c.textMuted }]}>
                      Total USD{"\n"}
                      <Text style={[styles.strong, { color: c.emerald }]}>
                        {formatMoney(
                          platformQ.data.summary.totalUsdCents,
                          "USD",
                        )}
                      </Text>
                    </Text>
                  </View>
                  <View style={{ gap: 6, marginTop: 8 }}>
                    {pagedFees.visible.map((fee) => (
                      <Text
                        key={fee.id}
                        style={{ color: c.textMuted, fontSize: 11 }}
                      >
                        {fee.kind} · {formatMoney(fee.amountUsdCents, "USD")} ·{" "}
                        {fee.shopName ?? fee.courierName ?? "—"}
                      </Text>
                    ))}
                    <PagedMore
                      hasMore={pagedFees.hasMore}
                      remaining={pagedFees.remaining}
                      onMore={pagedFees.more}
                    />
                  </View>
                </View>
              ) : null}

              <View
                style={[
                  styles.card,
                  { backgroundColor: c.card, borderColor: HAIRLINE },
                ]}
              >
                <Text style={[styles.section, { color: c.text }]}>
                  Funnel contenu → achat
                </Text>
                <Text style={[styles.meta, { color: c.textMuted }]}>
                  GMV{" "}
                  {formatMoney(
                    report.summary.gmvCents ?? report.summary.soldCents,
                  )}
                  {" · "}
                  panier moyen {formatMoney(report.summary.aovCents ?? 0)}
                  {" · "}
                  take rate{" "}
                  {((report.summary.takeRateBps ?? 0) / 100).toFixed(1)} %
                </Text>
                <View style={styles.funnel}>
                  <Text style={{ color: c.text, fontSize: 12 }}>
                    Vues feed{"\n"}
                    <Text style={styles.strong}>
                      {report.funnel?.feed ?? 0}
                    </Text>
                  </Text>
                  <Text style={{ color: c.text, fontSize: 12 }}>
                    Fiches{"\n"}
                    <Text style={styles.strong}>
                      {report.funnel?.product ?? 0}
                    </Text>
                    <Text style={{ color: c.textMuted }}>
                      {" "}
                      ({((report.funnel?.feedToCardBps ?? 0) / 100).toFixed(
                        1,
                      )}{" "}
                      %)
                    </Text>
                  </Text>
                  <Text style={{ color: c.text, fontSize: 12 }}>
                    Achats{"\n"}
                    <Text style={styles.strong}>
                      {report.funnel?.purchase ?? 0}
                    </Text>
                    <Text style={{ color: c.textMuted }}>
                      {" "}
                      ({((report.funnel?.cardToBuyBps ?? 0) / 100).toFixed(
                        1,
                      )}{" "}
                      %)
                    </Text>
                  </Text>
                </View>
                {(report.wantedIntent?.length ?? 0) > 0 ? (
                  report.wantedIntent!.slice(0, 6).map((row) => (
                    <Text
                      key={row.category}
                      style={{ color: c.textMuted, fontSize: 11 }}
                    >
                      Besoin {row.category} · {row.count} · budget moy.{" "}
                      {formatMoney(row.avgBudgetCents)}
                    </Text>
                  ))
                ) : (
                  <Text style={{ color: c.textMuted, fontSize: 11 }}>
                    ShipNeeds reste gratuit — l’intention d’achat alimente le
                    reco.
                  </Text>
                )}
              </View>

              {report.insights.peakWeekday || report.insights.peakHour ? (
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: `${c.primary}18`,
                      borderColor: `${c.primary}40`,
                    },
                  ]}
                >
                  <Text style={[styles.section, { color: c.primary }]}>
                    Pics d’achats en ligne
                  </Text>
                  <Text
                    style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}
                  >
                    Meilleur jour :{" "}
                    <Text style={{ color: c.text, fontWeight: "700" }}>
                      {report.insights.peakWeekday ?? "—"}
                    </Text>{" "}
                    ({formatMoney(report.insights.peakWeekdayCents)}) · Heure
                    forte :{" "}
                    <Text style={{ color: c.text, fontWeight: "700" }}>
                      {report.insights.peakHour ?? "—"}
                    </Text>{" "}
                    ({formatMoney(report.insights.peakHourCents)})
                  </Text>
                </View>
              ) : null}

              <View
                style={[
                  styles.tabBar,
                  { backgroundColor: c.card, borderColor: HAIRLINE },
                ]}
              >
                {(
                  [
                    ["overview", "Vue"],
                    ["products", "Produits"],
                    ["attention", "À traiter"],
                  ] as const
                ).map(([key, label]) => {
                  const on = tab === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setTab(key)}
                      style={[
                        styles.tabBtn,
                        on && { backgroundColor: "rgba(127,127,140,0.16)" },
                      ]}
                    >
                      <Text
                        style={{
                          color: on ? c.text : c.textMuted,
                          fontWeight: "800",
                          fontSize: 12,
                        }}
                      >
                        {label}
                      </Text>
                      {key === "attention" && attentionCount > 0 ? (
                        <View
                          style={[styles.dot, { backgroundColor: "#FBBF24" }]}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              {tab === "overview" ? (
                <View style={{ gap: 12 }}>
                  <View
                    style={[
                      styles.card,
                      { backgroundColor: c.card, borderColor: HAIRLINE },
                    ]}
                  >
                    <Text style={[styles.section, { color: c.text }]}>
                      Évolution du CA remis
                    </Text>
                    <Text style={[styles.meta, { color: c.textMuted }]}>
                      {report.periodLabel}
                    </Text>
                    <LineChart series={report.series} color={c.primary} />
                  </View>
                  <View
                    style={[
                      styles.card,
                      { backgroundColor: c.card, borderColor: HAIRLINE },
                    ]}
                  >
                    <Text style={[styles.section, { color: c.text }]}>
                      Par jour de la semaine
                    </Text>
                    <View style={{ gap: 10, marginTop: 10 }}>
                      {report.weekdayHeat.map((d) => {
                        const pct = Math.round(
                          (d.revenueCents / weekdayMax) * 100,
                        );
                        return (
                          <View key={d.day} style={{ gap: 4 }}>
                            <View style={styles.barHead}>
                              <Text
                                style={{
                                  color: c.text,
                                  fontWeight: "700",
                                  fontSize: 11,
                                }}
                              >
                                {d.day} · {d.orders} cmd
                              </Text>
                              <Text
                                style={{ color: c.textMuted, fontSize: 11 }}
                              >
                                {formatMoney(d.revenueCents)}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.barTrack,
                                { backgroundColor: "rgba(127,127,140,0.16)" },
                              ]}
                            >
                              <View
                                style={{
                                  width: `${pct}%`,
                                  height: 8,
                                  borderRadius: 99,
                                  backgroundColor: c.primary,
                                }}
                              />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                  {hourBusy.length > 0 ? (
                    <View
                      style={[
                        styles.card,
                        { backgroundColor: c.card, borderColor: HAIRLINE },
                      ]}
                    >
                      <Text style={[styles.section, { color: c.text }]}>
                        Heures d’achat
                      </Text>
                      <View style={styles.hours}>
                        {hourBusy.map((h) => (
                          <View key={h.hour} style={styles.hourCell}>
                            <View
                              style={{
                                height: 28,
                                width: "100%",
                                borderRadius: 4,
                                backgroundColor: c.primary,
                                opacity: 0.15 + h.intensity * 0.85,
                              }}
                            />
                            <Text style={{ color: c.textMuted, fontSize: 8 }}>
                              {h.hour}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                  {vendors.length > 0 ? (
                    <View
                      style={[
                        styles.card,
                        { backgroundColor: c.card, borderColor: HAIRLINE },
                      ]}
                    >
                      <Text style={[styles.section, { color: c.text }]}>
                        {isOwner
                          ? "Vendeurs — gain, bénéfice & solde"
                          : "Mes boutiques"}
                      </Text>
                      <View style={{ gap: 8, marginTop: 10 }}>
                        {pagedVendors.visible.map((v) => (
                          <Pressable
                            key={v.shopId}
                            onPress={() => setShopId(v.shopId)}
                            style={[
                              styles.vendor,
                              {
                                borderColor: HAIRLINE,
                                backgroundColor: c.background,
                              },
                            ]}
                          >
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{ color: c.text, fontWeight: "700" }}
                                numberOfLines={1}
                              >
                                {v.shopName}
                              </Text>
                              <Text
                                style={{ color: c.textMuted, fontSize: 11 }}
                              >
                                {v.ownerName ? `${v.ownerName} · ` : ""}
                                {v.orders} ventes · Gain{" "}
                                {formatMoney(v.gainCents)}
                              </Text>
                            </View>
                            <View>
                              <Text
                                style={{
                                  color: c.emerald,
                                  fontWeight: "800",
                                  textAlign: "right",
                                }}
                              >
                                {formatMoney(v.balanceCents)}
                              </Text>
                              <Text
                                style={{
                                  color: c.textMuted,
                                  fontSize: 10,
                                  textAlign: "right",
                                }}
                              >
                                solde
                              </Text>
                            </View>
                          </Pressable>
                        ))}
                        <PagedMore
                          hasMore={pagedVendors.hasMore}
                          remaining={pagedVendors.remaining}
                          onMore={pagedVendors.more}
                        />
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {tab === "products" ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: c.textMuted, fontSize: 11 }}>
                    {isOwner
                      ? "Top produits plateforme — vendu vs stock (qté × prix)"
                      : "Vos produits uniquement — vendu vs budget stock (qté × prix)"}
                  </Text>
                  {products.length === 0 ? (
                    <Text
                      style={{
                        color: c.textMuted,
                        textAlign: "center",
                        paddingVertical: 24,
                      }}
                    >
                      Aucun produit
                    </Text>
                  ) : (
                    <>
                      {pagedProducts.visible.map((p) => {
                        const total = Math.max(1, p.soldCents + p.unsoldCents);
                        const soldPct = Math.round((p.soldCents / total) * 100);
                        const cover = mediaUrl(p.image);
                        return (
                          <View
                            key={p.id}
                            style={[
                              styles.card,
                              {
                                backgroundColor: c.card,
                                borderColor: HAIRLINE,
                              },
                            ]}
                          >
                            <View style={{ flexDirection: "row", gap: 10 }}>
                              {cover ? (
                                <Image
                                  source={{ uri: cover }}
                                  style={styles.thumb}
                                  contentFit="cover"
                                />
                              ) : (
                                <View
                                  style={[
                                    styles.thumb,
                                    {
                                      backgroundColor: "rgba(127,127,140,0.2)",
                                    },
                                  ]}
                                />
                              )}
                              <View style={{ flex: 1, gap: 4 }}>
                                <Text
                                  style={{ color: c.text, fontWeight: "700" }}
                                  numberOfLines={1}
                                >
                                  {p.title}
                                </Text>
                                <Text
                                  style={{ color: c.textMuted, fontSize: 11 }}
                                >
                                  {p.shopName} · {p.soldQty} vendus ·{" "}
                                  {p.stockQty} en stock
                                </Text>
                                <View
                                  style={[
                                    styles.barTrack,
                                    {
                                      backgroundColor: "rgba(127,127,140,0.16)",
                                    },
                                  ]}
                                >
                                  <View
                                    style={{
                                      width: `${soldPct}%`,
                                      height: 8,
                                      backgroundColor: c.emerald,
                                    }}
                                  />
                                  <View
                                    style={{
                                      width: `${100 - soldPct}%`,
                                      height: 8,
                                      backgroundColor: "#FBBF24",
                                    }}
                                  />
                                </View>
                                <View style={styles.barHead}>
                                  <Text
                                    style={{ color: c.emerald, fontSize: 10 }}
                                  >
                                    Vendu {formatMoney(p.soldCents)}
                                  </Text>
                                  <Text
                                    style={{ color: "#FBBF24", fontSize: 10 }}
                                  >
                                    Non vendu {formatMoney(p.unsoldCents)}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                      <PagedMore
                        hasMore={pagedProducts.hasMore}
                        remaining={pagedProducts.remaining}
                        onMore={pagedProducts.more}
                      />
                    </>
                  )}
                </View>
              ) : null}

              {tab === "attention" ? (
                <View style={{ gap: 12 }}>
                  <AttentionBlock
                    title="Signalements urgents ouverts"
                    empty="Aucun signalement ouvert"
                    count={issues.length}
                    warn
                  >
                    {pagedIssues.visible.map((i) => (
                      <View
                        key={i.id}
                        style={[
                          styles.issue,
                          { backgroundColor: "rgba(251,191,36,0.12)" },
                        ]}
                      >
                        <Text
                          style={{
                            color: "#FBBF24",
                            fontWeight: "800",
                            fontSize: 12,
                          }}
                        >
                          {i.type} · {i.order.shop.name}
                        </Text>
                        <Text
                          style={{ color: c.textMuted, fontSize: 11 }}
                          numberOfLines={1}
                        >
                          {i.order.product.title} — {i.order.buyer.name}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 12,
                            marginTop: 6,
                          }}
                        >
                          <Pressable
                            onPress={() =>
                              router.push(`/orders/${i.orderId}` as Href)
                            }
                          >
                            <Text
                              style={{
                                color: c.primary,
                                fontWeight: "700",
                                fontSize: 12,
                              }}
                            >
                              Commande →
                            </Text>
                          </Pressable>
                          {i.conversationId ? (
                            <Pressable
                              onPress={() =>
                                router.push(
                                  `/messages/${i.conversationId}` as Href,
                                )
                              }
                            >
                              <Text
                                style={{
                                  color: "#FBBF24",
                                  fontWeight: "700",
                                  fontSize: 12,
                                }}
                              >
                                Messages →
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    ))}
                    <PagedMore
                      hasMore={pagedIssues.hasMore}
                      remaining={pagedIssues.remaining}
                      onMore={pagedIssues.more}
                    />
                  </AttentionBlock>
                  <AttentionList
                    title="Annulations (toujours visibles)"
                    empty="Aucune annulation sur la période"
                    rows={pagedCancelled.visible}
                    hasMore={pagedCancelled.hasMore}
                    remaining={pagedCancelled.remaining}
                    onMore={pagedCancelled.more}
                    count={cancelled.length}
                  />
                  <AttentionList
                    title="Remboursements"
                    empty="Aucun remboursement sur la période"
                    rows={pagedRefunded.visible}
                    hasMore={pagedRefunded.hasMore}
                    remaining={pagedRefunded.remaining}
                    onMore={pagedRefunded.more}
                    count={refunded.length}
                  />
                  <AttentionList
                    title="Livraisons échouées"
                    empty="Aucun échec"
                    rows={pagedFailed.visible}
                    hasMore={pagedFailed.hasMore}
                    remaining={pagedFailed.remaining}
                    onMore={pagedFailed.more}
                    count={failed.length}
                  />
                </View>
              ) : null}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Kpi({
  icon,
  iconColor,
  label,
  value,
  hint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: string;
  hint: string;
}) {
  const c = useColors();
  return (
    <View
      style={[styles.kpi, { backgroundColor: c.card, borderColor: HAIRLINE }]}
    >
      <Ionicons name={icon} size={16} color={iconColor} />
      <Text style={[styles.kpiValue, { color: c.text }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={{ color: c.textMuted, fontSize: 10 }}>{hint}</Text>
    </View>
  );
}

function AttentionBlock({
  title,
  empty,
  count,
  warn,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  warn?: boolean;
  children: ReactNode;
}) {
  const c = useColors();
  return (
    <View
      style={[styles.card, { backgroundColor: c.card, borderColor: HAIRLINE }]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {warn ? (
          <Ionicons name="warning-outline" size={14} color="#FBBF24" />
        ) : null}
        <Text style={[styles.section, { color: c.text, flex: 1 }]}>
          {title}
        </Text>
        {count > 0 ? (
          <Text style={{ color: c.textMuted, fontSize: 11 }}>{count}</Text>
        ) : null}
      </View>
      {count === 0 ? (
        <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 8 }}>
          {empty}
        </Text>
      ) : (
        <View style={{ gap: 8, marginTop: 10 }}>{children}</View>
      )}
    </View>
  );
}

function AttentionList({
  title,
  empty,
  rows,
  count,
  hasMore,
  remaining,
  onMore,
}: {
  title: string;
  empty: string;
  rows: AttentionOrder[];
  count: number;
  hasMore: boolean;
  remaining: number;
  onMore: () => void;
}) {
  const c = useColors();
  return (
    <AttentionBlock title={title} empty={empty} count={count}>
      {rows.map((order) => {
        const cover = mediaUrl(order.product.images[0]);
        return (
          <Pressable
            key={order.id}
            onPress={() => router.push(`/orders/${order.id}` as Href)}
            style={[styles.vendor, { borderColor: HAIRLINE }]}
          >
            {cover ? (
              <Image
                source={{ uri: cover }}
                style={styles.tiny}
                contentFit="cover"
              />
            ) : (
              <View
                style={[
                  styles.tiny,
                  { backgroundColor: "rgba(127,127,140,0.2)" },
                ]}
              />
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: c.text, fontWeight: "700", fontSize: 12 }}
                numberOfLines={1}
              >
                {order.product.title}
              </Text>
              <Text
                style={{ color: c.textMuted, fontSize: 10 }}
                numberOfLines={1}
              >
                {order.shop.name} · {order.buyer.name} ·{" "}
                {statusLabel(order.status)}
              </Text>
            </View>
            <Text style={{ color: c.text, fontWeight: "800", fontSize: 11 }}>
              {formatMoney(order.totalCents || order.productCents)}
            </Text>
          </Pressable>
        );
      })}
      <PagedMore hasMore={hasMore} remaining={remaining} onMore={onMore} />
    </AttentionBlock>
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
  lead: { fontSize: 12, marginTop: 4, lineHeight: 18 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderRadius: 10,
    paddingHorizontal: 10,
    minHeight: 36,
    justifyContent: "center",
  },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpi: {
    width: "48%",
    flexGrow: 1,
    flexBasis: "46%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  kpiValue: { fontSize: 16, fontWeight: "800" },
  kpiLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 6 },
  section: { fontSize: 13, fontWeight: "800" },
  meta: { fontSize: 11 },
  strong: { fontWeight: "800" },
  funnel: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  tabBar: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: 8,
    right: 18,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  barHead: { flexDirection: "row", justifyContent: "space-between" },
  barTrack: {
    height: 8,
    borderRadius: 99,
    overflow: "hidden",
    flexDirection: "row",
  },
  hours: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  hourCell: { width: "11%", alignItems: "center", gap: 4 },
  vendor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  thumb: { width: 44, height: 44, borderRadius: 12 },
  tiny: { width: 36, height: 36, borderRadius: 8 },
  issue: { borderRadius: 12, padding: 10, gap: 2 },
  primary: { borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  primaryText: { fontWeight: "800" },
});
