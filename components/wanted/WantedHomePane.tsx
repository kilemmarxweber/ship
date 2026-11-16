import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { api, mediaUrl } from "@/src/api";
import { formatMoney } from "@/src/format";
import { useMe } from "@/src/me";
import { useSession } from "@/src/session";
import {
    wantedIsOpen,
    wantedOfferCount,
    type WantedListItem,
    type WantedOffer,
} from "@/src/wanted";

const FALLBACK_COVER = require("@/assets/images/maquette/wanted-headphones-cover.jpg");
const FALLBACK_AIRPODS = require("@/assets/images/maquette/wanted-airpods.png");

/** Tokens maquette « Je cherche » (alignés design system dark ShipShop). */
const T = {
  bg: "#05080D",
  card: "#151A22",
  cardSoft: "#1A2230",
  orange: "#FF5A1F",
  text: "#F5F7FA",
  muted: "#9AA3B5",
  border: "rgba(255,255,255,0.06)",
  activeBg: "rgba(0,214,165,0.16)",
  activeFg: "#00D6A5",
  hero: ["#FF5A1F", "#E11D8F", "#3B82F6"] as const,
} as const;

type OfferRow = {
  key: string;
  requestId: string;
  requestTitle: string;
  currency?: string;
  cover?: string;
  offer: WantedOffer;
};

type Props = {
  items: WantedListItem[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  paddingTop: number;
};

function conditionLabel(condition?: string | null) {
  if (condition === "NEW_SHOP") return "Neuf";
  if (condition === "USED") return "En bon état";
  return "En bon état";
}

function Cover({
  uri,
  size = 64,
  fallback = FALLBACK_AIRPODS,
  radius = 16,
}: {
  uri?: string | null;
  size?: number;
  fallback?: number;
  radius?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: "hidden",
        backgroundColor: "#F3F4F6",
      }}
    >
      <Image
        source={uri ? { uri: mediaUrl(uri) ?? uri } : fallback}
        style={{ width: size, height: size }}
        contentFit="cover"
        contentPosition="center"
        recyclingKey={uri ?? String(fallback)}
        transition={120}
      />
    </View>
  );
}

export function WantedHomePane({
  items,
  loading,
  error,
  onRetry,
  paddingTop,
}: Props) {
  const token = useSession((s) => s.token);
  const openAuth = useSession((s) => s.openAuth);
  const me = useMe();
  const myId = me.data?.id;
  const [showAllMine, setShowAllMine] = useState(false);
  const [showAllOffers, setShowAllOffers] = useState(false);
  const [publicFilter, setPublicFilter] = useState<string>("Tout");

  const mine = items.filter(
    (row) => row.isOwner || (myId && row.buyer?.id === myId),
  );
  const offerRows: OfferRow[] = mine.flatMap((req) =>
    (req.offers ?? [])
      .filter((o) => o.status !== "DECLINED")
      .map((offer) => ({
        key: `${req.id}:${offer.id}`,
        requestId: req.id,
        requestTitle: req.title,
        currency: req.currency,
        cover: offer.images?.[0] ?? req.images?.[0],
        offer,
      })),
  );
  const others = items.filter(
    (row) => !(row.isOwner || (myId && row.buyer?.id === myId)),
  );
  const publicCategories = [
    "Tout",
    ...Array.from(
      new Set(others.map((row) => row.category).filter(Boolean)),
    ).slice(0, 4),
  ];
  const visibleOthers =
    publicFilter === "Tout"
      ? others
      : others.filter((row) => row.category === publicFilter);

  function createWanted() {
    if (!token) {
      openAuth();
      return;
    }
    router.push({ pathname: "/(tabs)/publish", params: { mode: "wanted" } });
  }

  async function contactSeller(row: OfferRow) {
    const shopId = row.offer.shop?.id;
    if (!token) {
      openAuth();
      return;
    }
    if (!shopId) {
      router.push(`/wanted/${row.requestId}` as Href);
      return;
    }
    try {
      const data = await api<{ conversation?: { id: string } }>(
        "/api/conversations",
        {
          method: "POST",
          body: JSON.stringify({
            shopId,
            wantedRequestId: row.requestId,
          }),
        },
      );
      if (data.conversation?.id) {
        router.push(`/messages/${data.conversation.id}` as Href);
      }
    } catch {
      router.push(`/wanted/${row.requestId}` as Href);
    }
  }

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { paddingTop, backgroundColor: T.bg }]}>
        <View style={[styles.skeleton, styles.skeletonHero]} />
        <View style={styles.skeletonTitle} />
        {[0, 1, 2].map((key) => (
          <View key={key} style={[styles.skeleton, styles.skeletonCard]} />
        ))}
        <ActivityIndicator color={T.activeFg} style={styles.loadingSpinner} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { paddingTop, backgroundColor: T.bg }]}>
        <Text style={styles.emptyTitle}>Demandes indisponibles</Text>
        <Pressable style={styles.retry} onPress={onRetry}>
          <Text style={styles.retryText}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }

  const listHeader = (
    <View style={styles.headerBlock} testID="wanted-home-pane">
      {/* Hero maquette */}
      <LinearGradient
        colors={[...T.hero]}
        locations={[0, 0.48, 1]}
        start={{ x: 0, y: 0.85 }}
        end={{ x: 1, y: 0.05 }}
        style={styles.hero}
      >
        <Ionicons
          name="search"
          size={34}
          color="#fff"
          style={styles.heroIcon}
        />
        <Text style={styles.heroTitle}>
          Publiez ce que vous{"\n"}recherchez
        </Text>
        <Text style={styles.heroSub}>
          Décrivez votre besoin, ajoutez un budget{"\n"}et recevez des offres.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.heroCta,
            pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
          ]}
          onPress={createWanted}
          accessibilityRole="button"
          accessibilityLabel="Créer une demande"
        >
          <Text style={styles.heroCtaText} numberOfLines={2}>
            Créer une demande
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#111722" />
        </Pressable>
      </LinearGradient>

      {/* Mes demandes */}
      <View style={styles.sectionRow}>
        <Text style={styles.section}>Mes demandes</Text>
        {mine.length > 2 ? (
          <Pressable onPress={() => setShowAllMine((value) => !value)}>
            <Text style={styles.seeAll}>
              {showAllMine ? "Réduire" : "Voir tout"} ›
            </Text>
          </Pressable>
        ) : null}
      </View>

      {mine.length === 0 ? (
        <View style={styles.requestCard}>
          <Cover uri={null} fallback={FALLBACK_AIRPODS} />
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Aucune demande ouverte</Text>
            <Text style={styles.meta}>
              Publiez ce que vous cherchez — les vendeurs vous envoient des
              offres.
            </Text>
          </View>
        </View>
      ) : (
        (showAllMine ? mine : mine.slice(0, 2)).map((item) => {
          const offers = wantedOfferCount(item);
          const cover = item.images[0];
          const active = wantedIsOpen(item);
          const maxLabel = formatMoney(item.budgetCents, item.currency);
          return (
            <Pressable
              key={item.id}
              onPress={() => router.push(`/wanted/${item.id}` as Href)}
              style={({ pressed }) => [
                styles.requestCard,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Cover uri={cover} fallback={FALLBACK_AIRPODS} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {conditionLabel(item.condition)} • Max {maxLabel}
                </Text>
                <View style={styles.cardFooter}>
                  <View
                    style={[
                      styles.badge,
                      active ? styles.badgeActive : styles.badgeMuted,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: active ? T.activeFg : T.muted },
                      ]}
                    >
                      {active ? "Active" : (item.status ?? "Fermée")}
                      {active
                        ? ` • ${offers} offre${offers > 1 ? "s" : ""}`
                        : ""}
                    </Text>
                  </View>
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={18}
                    color={T.muted}
                  />
                </View>
              </View>
            </Pressable>
          );
        })
      )}

      {/* Offres reçues */}
      <View style={[styles.sectionRow, { marginTop: 18 }]}>
        <Text style={styles.section}>Offres reçues</Text>
        {offerRows.length > 3 ? (
          <Pressable onPress={() => setShowAllOffers((value) => !value)}>
            <Text style={styles.seeAll}>
              {showAllOffers ? "Réduire" : "Voir tout"} ›
            </Text>
          </Pressable>
        ) : null}
      </View>
      {offerRows.length === 0 ? (
        <View style={styles.requestCard}>
          <Cover uri={null} fallback={FALLBACK_COVER} />
          <View style={styles.cardBody}>
            <Text style={styles.meta}>
              Les offres des vendeurs apparaîtront ici.
            </Text>
          </View>
        </View>
      ) : (
        (showAllOffers ? offerRows : offerRows.slice(0, 3)).map((row) => (
          <View key={row.key} style={styles.requestCard}>
            <Cover uri={row.cover} fallback={FALLBACK_COVER} />
            <View style={styles.cardBody}>
              <Text style={styles.meta} numberOfLines={1}>
                Proposé par{" "}
                <Text style={styles.cardTitle}>
                  {row.offer.shop?.name ?? row.offer.seller?.name ?? "Vendeur"}
                </Text>
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {formatMoney(row.offer.priceCents, row.currency)}
                {" • "}
                {conditionLabel(row.offer.condition)}
              </Text>
              <View style={styles.cardFooter}>
                <Pressable
                  style={({ pressed }) => [
                    styles.contactBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => void contactSeller(row)}
                  accessibilityRole="button"
                >
                  <Text style={styles.contactText}>Contacter</Text>
                </Pressable>
                <Ionicons
                  name="ellipsis-horizontal"
                  size={18}
                  color={T.muted}
                />
              </View>
            </View>
          </View>
        ))
      )}

      {others.length > 0 ? (
        <>
          <Text style={[styles.section, { marginTop: 18 }]}>
            Demandes près de vous
          </Text>
          <View style={styles.filterRow}>
            {publicCategories.map((filter) => (
              <Pressable
                key={filter}
                onPress={() => setPublicFilter(filter)}
                style={[
                  styles.filterChip,
                  publicFilter === filter && styles.filterChipOn,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    publicFilter === filter && styles.filterTextOn,
                  ]}
                >
                  {filter}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.pane, { paddingTop, backgroundColor: T.bg }]}>
      <FlashList
        data={visibleOthers}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        renderItem={({ item }) => {
          const cover = item.images[0];
          const offers = wantedOfferCount(item);
          return (
            <Pressable
              onPress={() => router.push(`/wanted/${item.id}` as Href)}
              style={styles.requestCard}
            >
              <Cover uri={cover} size={58} fallback={FALLBACK_AIRPODS} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.meta}>
                  {conditionLabel(item.condition)} • Max{" "}
                  {formatMoney(item.budgetCents, item.currency)}
                </Text>
                <Text style={styles.meta}>
                  {offers} offre{offers > 1 ? "s" : ""}
                  {item.commune ? ` · ${item.commune}` : ""}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pane: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingWrap: { flex: 1, paddingHorizontal: 16, gap: 12 },
  skeleton: { backgroundColor: "#171D27", overflow: "hidden" },
  skeletonHero: { height: 220, borderRadius: 26 },
  skeletonTitle: {
    width: 130,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#202733",
    marginTop: 6,
  },
  skeletonCard: { height: 92, borderRadius: 22 },
  loadingSpinner: { position: "absolute", alignSelf: "center", top: "32%" },
  emptyTitle: { color: T.text, fontSize: 17, fontWeight: "700" },
  retry: {
    backgroundColor: T.orange,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: { color: "#fff", fontWeight: "700" },
  headerBlock: { gap: 14, marginBottom: 4 },
  hero: {
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#FF5A1F",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.28,
        shadowRadius: 18,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  heroIcon: {
    marginBottom: 12,
    textShadowColor: "rgba(255,255,255,0.35)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
    textAlign: "center",
    letterSpacing: 0.1,
    marginBottom: 8,
  },
  heroSub: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 16,
  },
  heroCta: {
    alignSelf: "stretch",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  heroCtaText: {
    flexShrink: 1,
    color: "#111722",
    fontWeight: "800",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    includeFontPadding: false,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    gap: 12,
  },
  section: {
    flexShrink: 1,
    color: T.text,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 24,
    paddingRight: 4,
    includeFontPadding: false,
  },
  seeAll: { color: T.muted, fontSize: 13, fontWeight: "600" },
  meta: { color: T.muted, fontSize: 13, fontWeight: "500", lineHeight: 18 },
  requestCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: T.card,
    borderRadius: 22,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
  },
  cardBody: { flex: 1, gap: 5, minWidth: 0, paddingTop: 1 },
  cardTitle: { color: T.text, fontSize: 15.5, fontWeight: "700" },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    gap: 8,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeActive: { backgroundColor: T.activeBg },
  badgeMuted: { backgroundColor: "rgba(170,180,200,0.12)" },
  badgeText: { fontSize: 12, fontWeight: "700" },
  contactBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: T.cardSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  contactText: { color: T.text, fontWeight: "700", fontSize: 12.5 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: T.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.border,
  },
  filterChipOn: {
    backgroundColor: T.activeBg,
    borderColor: "rgba(0,214,165,0.35)",
  },
  filterText: { color: T.muted, fontSize: 12, fontWeight: "700" },
  filterTextOn: { color: T.activeFg },
});
