import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useIsFocused, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DiscoverCard } from "@/components/discover/DiscoverCard";
import { EventPoster } from "@/components/events/EventPoster";
import { BuySheet } from "@/components/feed/Sheets";
import { ChallengeCard } from "@/components/growth/ChallengeCard";
import { api, mediaUrl } from "@/src/api";
import { templateFor } from "@/src/challenge-place";
import { compactCount, formatMoney } from "@/src/format";
import { convertCents, eventFxRates } from "@/src/fx";
import { coverOf, mediaList, productHasAudio } from "@/src/media";
import { useOnline } from "@/src/offline/network";
import { persistDiscover } from "@/src/offline/persist";
import {
    flattenUniqueProducts,
    isLocalFeedCursor,
    normalizeFeedPage,
    safeNextCursor,
} from "@/src/product-normalize";
import { useSession } from "@/src/session";
import { categories, categoryLooks, colors } from "@/src/theme";
import type { PublicEvent } from "@/src/tickets";
import { showToast } from "@/src/toast";
import type {
    FeedPage,
    GrowthChallenge,
    GrowthSurface,
    Product,
} from "@/src/types";
import { parseWalletCurrency } from "@/src/wallet";

function CategoryChip({
  name,
  selected,
  onPress,
}: {
  name: (typeof categories)[number];
  selected: boolean;
  onPress: () => void;
}) {
  const look = categoryLooks[name];
  return (
    <Pressable onPress={onPress} style={styles.catWrap}>
      <View style={styles.catInner}>
        <View
          style={[
            styles.catOrb,
            {
              backgroundColor: look.colors[0],
              opacity: selected ? 1 : 0.88,
            },
            selected && styles.catOrbOn,
          ]}
        >
          <Ionicons name={look.icon} size={22} color="#fff" />
        </View>
        <Text
          style={[
            styles.catLabel,
            selected && styles.catLabelOn,
            { color: selected ? colors.white : colors.muted },
          ]}
        >
          {name}
        </Text>
      </View>
    </Pressable>
  );
}

export function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const focused = useIsFocused();
  const token = useSession((state) => state.token);
  const online = useOnline();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const stripFocusLock = useRef(false);
  const fetchingNextPage = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(timer);
  }, [query]);

  const feed = useInfiniteQuery({
    queryKey: ["discover", debounced, category, token ?? "guest"],
    initialPageParam: "",
    staleTime: 45_000,
    gcTime: 24 * 60 * 60 * 1000,
    networkMode: "offlineFirst",
    queryFn: async ({ pageParam }) => {
      if (isLocalFeedCursor(pageParam)) {
        return { products: [], nextCursor: null };
      }
      const params = new URLSearchParams({ status: "ACTIVE", limit: "16" });
      if (pageParam) params.set("cursor", String(pageParam));
      if (debounced) params.set("q", debounced);
      if (category) params.set("category", category);
      try {
        return normalizeFeedPage(
          await api<FeedPage>(`/api/products?${params.toString()}`),
        );
      } catch (error) {
        if (!pageParam) throw error;
        return { products: [], nextCursor: null };
      }
    },
    getNextPageParam: (last, _pages, _lastPageParam, pageParams) =>
      safeNextCursor(last, pageParams),
    retry: 1,
  });

  useEffect(() => {
    if (debounced || category || !feed.data?.pages) return;
    persistDiscover(token, feed.data.pages);
  }, [debounced, category, token, feed.data]);

  const liveEvents = useQuery({
    queryKey: ["public-events"],
    queryFn: () => api<{ events: PublicEvent[] }>("/api/events"),
  });

  const wallet = useQuery({
    queryKey: ["wallet", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () =>
      api<{ displayCurrency?: string; wallet?: { currency?: string } }>(
        "/api/wallet",
      ),
  });
  const displayCurrency = parseWalletCurrency(
    wallet.data?.displayCurrency ?? wallet.data?.wallet?.currency,
  );

  const deals = useInfiniteQuery({
    queryKey: ["discover-deals"],
    initialPageParam: "",
    networkMode: "offlineFirst",
    queryFn: async ({ pageParam }) => {
      if (isLocalFeedCursor(pageParam)) {
        return { products: [], nextCursor: null };
      }
      const params = new URLSearchParams({
        status: "ACTIVE",
        deals: "1",
        limit: "12",
      });
      if (pageParam) params.set("cursor", String(pageParam));
      try {
        return normalizeFeedPage(
          await api<FeedPage>(`/api/products?${params.toString()}`),
        );
      } catch (error) {
        if (!pageParam) throw error;
        return { products: [], nextCursor: null };
      }
    },
    getNextPageParam: (last, _pages, _lastPageParam, pageParams) =>
      safeNextCursor(last, pageParams),
    retry: 1,
  });

  const surface = useQuery({
    queryKey: ["growth-surface"],
    queryFn: () => api<GrowthSurface>("/api/growth/surface"),
    staleTime: 20_000,
  });

  const searching = Boolean(debounced);
  const products = useMemo(
    () => flattenUniqueProducts(feed.data?.pages),
    [feed.data],
  );
  const dealProducts = useMemo(
    () => flattenUniqueProducts(deals.data?.pages).slice(0, 12),
    [deals.data],
  );

  const featured = products.slice(0, 12);
  const videos = products.filter(productHasAudio).slice(0, 12);
  const budget = [...products]
    .sort((a, b) => a.priceCents - b.priceCents)
    .slice(0, 12);
  const popularCats = categories
    .map((id) => {
      const hit = products.find(
        (item) => item.category === id && coverOf(item.images),
      );
      return hit ? { id, image: coverOf(hit.images) } : null;
    })
    .filter((row): row is { id: (typeof categories)[number]; image: string } =>
      Boolean(row?.image),
    );

  const fallbackFocus = videos[0]?.id
    ? `video:${videos[0].id}`
    : featured[0]?.id
      ? `featured:${featured[0].id}`
      : null;
  const activeFocus = focusKey ?? fallbackFocus;

  const stripW = Math.min(270, Math.round(width * 0.67));
  const stripH = 330;
  const stripGap = 12;
  const colW = width / 2 - 12;
  const colH = colW * 1.42;
  const playing = Boolean(focused);
  const challenge = surface.data?.challenges?.find((row) => !row.done) ?? null;
  const highlights = surface.data?.highlights ?? [];
  const stories = surface.data?.stories ?? [];

  const focusStrip = useCallback(
    (prefix: string, items: Product[], offsetX: number) => {
      if (!items.length) return;
      const index = Math.max(
        0,
        Math.min(items.length - 1, Math.round(offsetX / (stripW + stripGap))),
      );
      const item = items[index];
      if (!item) return;
      const key = `${prefix}:${item.id}`;
      stripFocusLock.current = true;
      setFocusKey((current) => (current === key ? current : key));
    },
    [stripW],
  );

  const onViewableItemsChanged = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: { isViewable: boolean; item?: Product }[];
    }) => {
      if (stripFocusLock.current) return;
      const visible = viewableItems
        .filter((row) => row.isViewable && row.item)
        .map((row) => row.item as Product);
      if (!visible.length) return;
      const withSound = visible.find((item) => productHasAudio(item));
      const pick = withSound ?? visible[0];
      if (!pick) return;
      const key = `results:${pick.id}`;
      setFocusKey((current) => (current === key ? current : key));
    },
  ).current;

  async function joinChallenge(item: GrowthChallenge) {
    try {
      const data = await api<{
        eventId?: string | null;
        event?: { id: string } | null;
      }>("/api/growth/challenge", {
        method: "POST",
        body: JSON.stringify({ challengeId: item.id }),
      });
      showToast("Challenge relevé.", "success");
      void surface.refetch();
      const eventId = data.eventId ?? data.event?.id ?? item.event?.id;
      if (eventId) {
        router.push(`/events/${eventId}` as Href);
      }
    } catch {
      showToast("Connecte-toi pour relever le challenge.", "info");
    }
  }

  function eventPriceLabel(event: PublicEvent) {
    const cents =
      event.fromPriceCents ??
      (event.ticketTypes?.length
        ? Math.min(...event.ticketTypes.map((type) => type.priceCents))
        : null);
    if (cents == null) return null;
    const converted = convertCents(
      cents,
      event.currency,
      displayCurrency,
      eventFxRates(event),
    );
    return `dès ${formatMoney(converted, displayCurrency)}`;
  }

  function renderStrip(
    title: string,
    items: Product[],
    prefix: string,
    videoBadge = false,
  ) {
    if (!items.length) return null;
    const onStripScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      focusStrip(prefix, items, event.nativeEvent.contentOffset.x);
    };
    return (
      <View style={styles.section}>
        <Text style={styles.kicker}>{title}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
          decelerationRate="fast"
          snapToInterval={stripW + stripGap}
          snapToAlignment="start"
          disableIntervalMomentum
          onScroll={onStripScroll}
          scrollEventThrottle={64}
          onMomentumScrollEnd={onStripScroll}
          onScrollEndDrag={onStripScroll}
        >
          {items.map((item) => {
            const key = `${prefix}:${item.id}`;
            return (
              <DiscoverCard
                key={key}
                product={item}
                width={stripW}
                height={stripH}
                videoBadge={videoBadge}
                playing={playing && activeFocus === key}
                muted={muted || activeFocus !== key}
                onFocus={() => setFocusKey(key)}
                onMute={() => {
                  setFocusKey(key);
                  setMuted((value) => (activeFocus === key ? !value : false));
                }}
                onBuy={() => setBuyProduct(item)}
              />
            );
          })}
        </ScrollView>
      </View>
    );
  }

  const header = (
    <View style={{ paddingTop: insets.top + 8 }}>
      <View>
        <Text style={styles.hero}>Découvrir</Text>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.55)" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un produit, vendeur…"
            placeholderTextColor="rgba(255,255,255,0.45)"
            style={styles.searchInput}
          />
        </View>
      </View>

      {!searching && (surface.data?.lives?.length ?? 0) > 0 ? (
        <View style={styles.section}>
          <Text style={styles.kicker}>Lives shopping</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
          >
            {(surface.data?.lives ?? [])
              .filter((live) => live.status !== "ENDED")
              .slice(0, 12)
              .map((live) => {
                const rawCover =
                  live.product?.images?.[0] || live.user?.image || null;
                const cover = rawCover
                  ? (mediaUrl(rawCover) ?? rawCover)
                  : null;
                const host =
                  live.hostLabel ||
                  (live.shop?.name && live.user?.name
                    ? `${live.shop.name} · ${live.user.name}`
                    : live.shop?.name || live.user?.name || "Créateur");
                return (
                  <Pressable
                    key={live.id}
                    style={styles.eventCard}
                    onPress={() =>
                      router.push({
                        pathname: "/live/[id]",
                        params: { id: live.id },
                      })
                    }
                  >
                    {cover ? (
                      <Image
                        source={{ uri: cover }}
                        style={styles.eventCover}
                      />
                    ) : (
                      <View
                        style={[
                          styles.eventCover,
                          { backgroundColor: "#16161f" },
                        ]}
                      />
                    )}
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.85)"]}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.liveShopBadge}>
                      <Text style={styles.liveShopBadgeText}>LIVE</Text>
                    </View>
                    <View style={styles.eventMeta}>
                      <Text style={styles.eventTitle} numberOfLines={2}>
                        {live.title || "Live shopping"}
                      </Text>
                      <Text style={styles.eventOrg} numberOfLines={1}>
                        {host}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
          </ScrollView>
        </View>
      ) : null}

      {!searching && (liveEvents.data?.events?.length ?? 0) > 0 ? (
        <View style={styles.section}>
          <Text style={styles.kicker}>Événements</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
          >
            {(liveEvents.data?.events ?? []).map((event) => (
              <Pressable
                key={event.id}
                style={styles.eventCard}
                onPress={() => router.push(`/events/${event.id}` as Href)}
              >
                <EventPoster
                  eventId={event.id}
                  imageUrl={event.imageUrl}
                  title={event.title}
                  organizerName={event.organizerName}
                  kind={event.organizerKind}
                  priceLabel={eventPriceLabel(event)}
                  buyLabel="Acheter billet"
                  style={styles.eventCover}
                />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {searching ? <Text style={styles.sectionHead}>Résultats</Text> : null}

      {!searching && challenge ? (
        <View style={styles.challengeCard}>
          <ChallengeCard
            challenge={challenge}
            template={templateFor(challenge.id, 0)}
            playing={playing}
            compact
            onJoin={() => void joinChallenge(challenge)}
          />
        </View>
      ) : null}

      {!searching && highlights.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionHead}>À la une</Text>
          <View style={styles.highlightGrid}>
            {highlights.slice(0, 4).map((item, index) => {
              const urls = mediaList(
                item.images?.length
                  ? item.images
                  : item.imageUrl
                    ? [item.imageUrl]
                    : [],
              );
              const cover = urls[0];
              return (
                <View key={item.id} style={styles.highlight}>
                  {cover ? (
                    <Image
                      source={{ uri: cover }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : null}
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.8)"]}
                    style={styles.highlightShade}
                  />
                  <Text style={styles.highlightTag}>
                    {item.hasVideo && index === 0
                      ? "Vidéo du moment"
                      : item.category}
                  </Text>
                  <Text style={styles.highlightTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.highlightMeta}>
                    {compactCount(item.viewsCount)} vues
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {!searching && stories.length ? (
        <View style={styles.section}>
          <Text style={styles.kicker}>Stories partenaires</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
          >
            {stories.map((story) => (
              <View key={story.id} style={styles.story}>
                {story.mediaUrl ? (
                  <Image
                    source={{ uri: mediaUrl(story.mediaUrl) ?? undefined }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: colors.sheet },
                    ]}
                  />
                )}
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.85)"]}
                  style={styles.storyShade}
                />
                <Text style={styles.storyTitle} numberOfLines={2}>
                  {story.title}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {!searching ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionHead}>Catégories</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cats}
            >
              {categories.map((item) => (
                <CategoryChip
                  key={item}
                  name={item}
                  selected={category === item}
                  onPress={() => {
                    setCategory((current) => (current === item ? null : item));
                    if (token) {
                      void api("/api/growth/activity", {
                        method: "POST",
                        body: JSON.stringify({ kind: "category" }),
                      }).catch(() => undefined);
                    }
                  }}
                />
              ))}
            </ScrollView>
          </View>

          <View style={styles.trendHead}>
            <Ionicons name="location" size={16} color={colors.emerald} />
            <Text style={[styles.heading, { paddingHorizontal: 0 }]}>
              Tendances à Kinshasa
            </Text>
          </View>
          {renderStrip("À la une", featured, "featured")}
          {renderStrip("Vidéos et sons", videos, "video", true)}
          {renderStrip("Petits prix", budget, "budget")}
          {renderStrip("Meilleures offres", dealProducts, "deals")}

          {popularCats.length > 1 ? (
            <View style={styles.section}>
              <Text style={styles.sectionHead}>Catégories populaires</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.strip}
              >
                {popularCats.map((row) => (
                  <Pressable
                    key={row.id}
                    onPress={() =>
                      setCategory((current) =>
                        current === row.id ? null : row.id,
                      )
                    }
                    style={styles.popCat}
                  >
                    <Image
                      source={{ uri: row.image }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.75)"]}
                      style={styles.popShade}
                    />
                    <Text style={styles.popLabel}>{row.id}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <Text style={styles.sectionHead}>Tous les produits</Text>
        </>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      {feed.isLoading && products.length === 0 ? (
        <View style={[styles.center, { paddingTop: insets.top + 40 }]}>
          <ActivityIndicator color={colors.emerald} />
        </View>
      ) : feed.isError && products.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Découvrir indisponible</Text>
          <Pressable style={styles.retry} onPress={() => void feed.refetch()}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          key={`discover:${token ?? "guest"}:${debounced}:${category ?? "all"}`}
          data={products}
          masonry
          numColumns={2}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          contentContainerStyle={{
            paddingBottom: 96 + insets.bottom,
          }}
          onEndReachedThreshold={0.7}
          onEndReached={() => {
            if (
              !online ||
              !focused ||
              !feed.hasNextPage ||
              feed.isFetchingNextPage ||
              feed.isError ||
              fetchingNextPage.current
            ) {
              return;
            }
            fetchingNextPage.current = true;
            void feed
              .fetchNextPage({ cancelRefetch: false })
              .catch(() => undefined)
              .finally(() => {
                fetchingNextPage.current = false;
              });
          }}
          onScroll={(event) => {
            if (event.nativeEvent.contentOffset.y > 80) {
              stripFocusLock.current = false;
            }
          }}
          scrollEventThrottle={80}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{
            itemVisiblePercentThreshold: 55,
            waitForInteraction: false,
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Aucun résultat</Text>
          }
          extraData={{ activeFocus, muted, playing }}
          renderItem={({ item }) => {
            const key = `results:${item.id}`;
            return (
              <View style={styles.gridItem}>
                <DiscoverCard
                  product={item}
                  width={colW}
                  height={colH}
                  playing={playing && activeFocus === key}
                  muted={muted || activeFocus !== key}
                  onFocus={() => setFocusKey(key)}
                  onMute={() => {
                    setFocusKey(key);
                    setMuted((value) => (activeFocus === key ? !value : false));
                  }}
                  onBuy={() => setBuyProduct(item)}
                />
              </View>
            );
          }}
        />
      )}
      <BuySheet
        product={buyProduct}
        onClose={() => setBuyProduct(null)}
        onAdded={() => undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  hero: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  search: {
    marginHorizontal: 16,
    marginBottom: 16,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#22222C",
    borderWidth: 1,
    borderColor: "#30303B",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 8,
  },
  searchInput: { flex: 1, color: "#fff", fontSize: 16 },
  challengeCard: {
    height: 420,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 28,
    overflow: "hidden",
  },
  challenge: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#16161F",
    flexDirection: "row",
    gap: 12,
    padding: 10,
  },
  challengeCover: { width: 86, height: 86, borderRadius: 16 },
  challengeKicker: {
    color: colors.emerald,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  challengeTitle: { color: "#fff", fontWeight: "800", fontSize: 15 },
  challengeBody: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  challengeCta: {
    alignSelf: "flex-start",
    backgroundColor: colors.emeraldDeep,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  challengeCtaText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  section: { marginBottom: 18 },
  heading: { color: "#fff", fontSize: 17, fontWeight: "800" },
  sectionHead: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  kicker: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  strip: { paddingHorizontal: 16, gap: 12 },
  eventCard: { width: 168 },
  eventCover: {
    width: 168,
    height: 210,
    borderRadius: 18,
    backgroundColor: "#16161F",
    overflow: "hidden",
  },
  liveShopBadge: {
    position: "absolute",
    left: 10,
    top: 10,
    backgroundColor: "#E11D48",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveShopBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  eventMeta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
  },
  eventTitle: { color: "#fff", fontSize: 13, fontWeight: "800" },
  eventOrg: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 },
  highlightGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  highlight: {
    width: "47.5%",
    aspectRatio: 4 / 3,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#16161F",
    justifyContent: "flex-end",
    padding: 10,
  },
  highlightShade: {
    ...StyleSheet.absoluteFill,
  },
  highlightTag: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 4,
  },
  highlightTitle: { color: "#fff", fontWeight: "800" },
  highlightMeta: { color: "rgba(255,255,255,0.65)", fontSize: 11 },
  story: {
    width: 132,
    height: 176,
    borderRadius: 18,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: 10,
  },
  storyShade: { ...StyleSheet.absoluteFill },
  storyTitle: { color: "#fff", fontWeight: "800", fontSize: 13 },
  cats: { paddingHorizontal: 12, gap: 4, paddingTop: 10 },
  catWrap: {
    width: 64,
    minHeight: 44,
    alignItems: "center",
  },
  catInner: { alignItems: "center", gap: 6 },
  catOrb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  catOrbOn: {
    borderWidth: 2,
    borderColor: "#fff",
  },
  catLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontWeight: "600",
  },
  catLabelOn: { color: "#fff" },
  trendHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  popCat: {
    width: 116,
    height: 88,
    borderRadius: 16,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: 8,
  },
  popShade: { ...StyleSheet.absoluteFill },
  popLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
  },
  gridItem: { padding: 6 },
  emptyTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  emptyText: {
    color: colors.muted,
    textAlign: "center",
    paddingVertical: 40,
  },
  retry: {
    backgroundColor: colors.emeraldDeep,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: { color: "#fff", fontWeight: "700" },
});
