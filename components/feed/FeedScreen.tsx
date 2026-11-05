import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import {
    useInfiniteQuery,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useIsFocused, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    Share,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from "react-native";
import Animated, { FadeOut, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ReelGallery } from "@/components/feed/ReelGallery";
import { ReelSoundtrack } from "@/components/feed/ReelVideo";
import {
    BuySheet,
    CommentsSheet,
    ShopProfileSheet,
} from "@/components/feed/Sheets";
import { ShopLiveAvatar } from "@/components/feed/ShopLiveAvatar";
import { ChallengeCard } from "@/components/growth/ChallengeCard";
import { NotificationsSheet } from "@/components/inbox/NotificationsSheet";
import { api, ApiError, apiOrigin, mediaUrl } from "@/src/api";
import {
    emptyWeaveMemory,
    weaveChallenges,
    type MixedRow,
} from "@/src/challenge-place";
import { colorHex } from "@/src/color";
import { compactCount, formatMoney } from "@/src/format";
import { useInbox } from "@/src/inbox";
import { matchOpenLive } from "@/src/live";
import { isSellerOfShop, useMe } from "@/src/me";
import { coverOf, mediaList } from "@/src/media";
import { kvGet, kvSet } from "@/src/offline/db";
import { feedQueryKey } from "@/src/offline/keys";
import { useOnline } from "@/src/offline/network";
import { persistFeed } from "@/src/offline/persist";
import { useSession } from "@/src/session";
import { isListableProduct, stockAlertColor, stockFraction } from "@/src/stock";
import { colors } from "@/src/theme";
import { showToast } from "@/src/toast";
import type { FeedPage, GrowthSurface, LiveTeaser, Product } from "@/src/types";
import { useColors } from "@/src/use-colors";
import {
    fetchWantedFeed,
    useWantedOfferSync,
    WANTED_FEED_KEY,
} from "@/src/wanted";

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    colors: Array.isArray(product.colors) ? product.colors : [],
    sizes: Array.isArray(product.sizes) ? product.sizes : [],
    description: product.description ?? null,
    quantity: product.quantity ?? 0,
  };
}

type FeedTab = "foryou" | "following" | "search";

function readLastTab(): FeedTab {
  const value = kvGet("lastTab");
  if (value === "foryou" || value === "following" || value === "search") {
    return value;
  }
  return "foryou";
}

export function FeedScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const focused = useIsFocused();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const queryClient = useQueryClient();
  const me = useMe();
  const [tab, setTab] = useState<FeedTab>(readLastTab);
  const online = useOnline();
  const [active, setActive] = useState(0);
  const listRef = useRef<FlashListRef<MixedRow<Product>>>(null);
  const weaveMemory = useRef(emptyWeaveMemory());
  const activeRowKeyRef = useRef<string | null>(null);
  const restoreRowKeyRef = useRef<string | null>(null);
  const wasOnlineRef = useRef(online);
  const [busyChallengeId, setBusyChallengeId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [likeBurstId, setLikeBurstId] = useState<string | null>(null);
  const [shopProduct, setShopProduct] = useState<Product | null>(null);
  const lastTapAt = useRef(0);
  const pendingTap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [commentProduct, setCommentProduct] = useState<Product | null>(null);
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [expandedCaptionId, setExpandedCaptionId] = useState<string | null>(
    null,
  );
  const [startingLiveId, setStartingLiveId] = useState<string | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [railEpoch, setRailEpoch] = useState(0);
  const inbox = useInbox();
  const inboxBadge = inbox.data?.badge ?? 0;
  const inboxUrgent = (inbox.data?.urgentCount ?? 0) > 0;

  const wanted = useQuery({
    queryKey: WANTED_FEED_KEY,
    enabled: tab === "search",
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: fetchWantedFeed,
  });
  const wantedItems = wanted.data?.requests ?? [];
  useWantedOfferSync(Boolean(token) && focused);

  const feed = useInfiniteQuery({
    queryKey: feedQueryKey(token, tab === "following" ? "following" : "foryou"),
    enabled: tab !== "search" && (tab !== "following" || Boolean(token)),
    initialPageParam: "",
    staleTime: 45_000,
    gcTime: 24 * 60 * 60 * 1000,
    networkMode: "offlineFirst",
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ status: "ACTIVE", limit: "12" });
      if (pageParam) params.set("cursor", pageParam);
      if (tab === "following") params.set("following", "1");
      const page = await api<FeedPage>(`/api/products?${params.toString()}`);
      return {
        ...page,
        products: (page.products ?? []).map(normalizeProduct),
      };
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  useEffect(() => {
    kvSet("lastTab", tab);
  }, [tab]);

  useEffect(() => {
    if (tab !== "foryou" || !feed.data?.pages) return;
    persistFeed(token, feed.data.pages);
  }, [tab, token, feed.data]);

  const surface = useQuery({
    queryKey: ["growth-surface"],
    queryFn: () => api<GrowthSurface>("/api/growth/surface"),
    staleTime: 20_000,
  });

  const lives = useQuery({
    queryKey: ["lives"],
    queryFn: () => api<{ lives: LiveTeaser[] }>("/api/growth/lives"),
    staleTime: 0,
    refetchInterval: (query) => {
      const open = (query.state.data?.lives ?? []).some(
        (row) => row.status !== "ENDED",
      );
      return open ? 2000 : 8000;
    },
  });

  const products = useMemo(
    () =>
      (feed.data?.pages.flatMap((page) => page.products) ?? [])
        .map(normalizeProduct)
        .filter(isListableProduct),
    [feed.data],
  );
  const isReelTab = tab === "foryou" || tab === "following";
  const feedRows = useMemo(() => {
    const challenges = tab === "foryou" ? (surface.data?.challenges ?? []) : [];
    const now = new Date();
    const seed = `${me.data?.id ?? "anon"}:${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
    return weaveChallenges(
      products,
      challenges,
      (item) => item.id,
      seed,
      weaveMemory.current,
      "feed",
    );
  }, [products, tab, surface.data?.challenges, me.data?.id]);

  useEffect(() => {
    const row = feedRows[active];
    if (!row) return;
    activeRowKeyRef.current = row.key;
    if (row.kind === "item") kvSet("lastProductId", row.item.id);
  }, [active, feedRows]);

  // Reconnexion: garder le produit / challenge actif après le refresh auto.
  useEffect(() => {
    const becameOnline = !wasOnlineRef.current && online;
    wasOnlineRef.current = online;
    if (becameOnline) {
      restoreRowKeyRef.current =
        activeRowKeyRef.current ?? feedRows[active]?.key ?? null;
    }
  }, [online, active, feedRows]);

  useEffect(() => {
    const targetKey = restoreRowKeyRef.current;
    if (!online || !targetKey || !isReelTab) return;
    if (feed.isFetching && !feed.data) return;

    const index = feedRows.findIndex((row) => row.key === targetKey);
    if (index < 0) {
      // Produit encore absent (pages suivantes) — on retentera au prochain update.
      return;
    }

    restoreRowKeyRef.current = null;
    if (index === active) return;

    setActive(index);
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToIndex({
          index,
          animated: false,
          viewPosition: 0,
        });
      } catch {
        listRef.current?.scrollToOffset({
          offset: index * height,
          animated: false,
        });
      }
    });
  }, [
    online,
    feedRows,
    feed.isFetching,
    feed.dataUpdatedAt,
    feed.data,
    active,
    isReelTab,
    height,
  ]);

  function selectTab(next: FeedTab) {
    setTab(next);
    setActive(0);
    setPaused(false);
    setMuted(false);
    restoreRowKeyRef.current = null;
  }

  const settleCard = useCallback(
    (offsetY: number) => {
      if (!isReelTab || height <= 0) return;
      const last = Math.max(0, feedRows.length - 1);
      const next = Math.max(0, Math.min(last, Math.round(offsetY / height)));
      setActive((current) => (current === next ? current : next));
      setPaused(false);
    },
    [height, isReelTab, feedRows.length],
  );

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      settleCard(event.nativeEvent.contentOffset.y);
    },
    [settleCard],
  );

  const onViewableItemsChanged = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: { index: number | null; isViewable: boolean }[];
    }) => {
      const next = viewableItems.find((item) => item.isViewable)?.index;
      if (typeof next === "number") {
        setActive((current) => (current === next ? current : next));
        setPaused(false);
      }
    },
  ).current;

  const requireAuth = useCallback(() => {
    if (token) return true;
    openAuth();
    return false;
  }, [openAuth, token]);

  async function joinChallenge(id: string, eventId?: string | null) {
    if (!requireAuth()) return;
    setBusyChallengeId(id);
    try {
      const data = await api<{
        eventId?: string | null;
        event?: { id: string } | null;
      }>("/api/growth/challenge", {
        method: "POST",
        body: JSON.stringify({ challengeId: id }),
      });
      queryClient.setQueryData<GrowthSurface>(["growth-surface"], (current) =>
        current
          ? {
              ...current,
              challenges: (current.challenges ?? []).map((row) =>
                row.id === id ? { ...row, done: true } : row,
              ),
            }
          : current,
      );
      showToast("Challenge relevé.", "success");
      const nextEventId = data.eventId ?? data.event?.id ?? eventId;
      if (nextEventId) {
        router.push(`/events/${nextEventId}` as Href);
      }
    } catch {
      showToast("Connecte-toi pour relever le challenge.", "info");
    } finally {
      setBusyChallengeId(null);
    }
  }

  function patchFeed(recipe: (product: Product) => Product) {
    queryClient.setQueriesData<{ pages: FeedPage[]; pageParams: unknown[] }>(
      { queryKey: ["feed"] },
      (current) => {
        if (!current) return current;
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            products: page.products.map(recipe),
          })),
        };
      },
    );
    setRailEpoch((value) => value + 1);
  }

  function liveProduct(id: string, fallback: Product) {
    const cached = queryClient.getQueryData<{ pages: FeedPage[] }>([
      "feed",
      tab,
      token ?? "guest",
    ]);
    return (
      cached?.pages
        .flatMap((page) => page.products)
        .find((row) => row.id === id) ?? fallback
    );
  }

  async function toggleLike(product: Product, opts?: { forceLike?: boolean }) {
    if (!requireAuth()) return false;
    const current = liveProduct(product.id, product);
    if (opts?.forceLike && current.likedByMe) return true;
    const liked = current.likedByMe;
    patchFeed((item) =>
      item.id === current.id
        ? {
            ...item,
            likedByMe: !liked,
            likesCount: Math.max(0, item.likesCount + (liked ? -1 : 1)),
          }
        : item,
    );
    try {
      const data = await api<{ liked?: boolean; likesCount?: number }>(
        `/api/products/${current.id}/like`,
        { method: liked ? "DELETE" : "POST" },
      );
      patchFeed((item) =>
        item.id === current.id
          ? {
              ...item,
              likedByMe: typeof data.liked === "boolean" ? data.liked : !liked,
              likesCount:
                typeof data.likesCount === "number"
                  ? data.likesCount
                  : item.likesCount,
            }
          : item,
      );
    } catch (cause) {
      patchFeed((item) =>
        item.id === current.id
          ? {
              ...item,
              likedByMe: liked,
              likesCount: current.likesCount,
            }
          : item,
      );
      if (cause instanceof ApiError && cause.status === 401) openAuth();
      return false;
    }
    return true;
  }

  function onMediaPress(product: Product) {
    const now = Date.now();
    if (now - lastTapAt.current < 280) {
      lastTapAt.current = 0;
      if (pendingTap.current) {
        clearTimeout(pendingTap.current);
        pendingTap.current = null;
      }
      setMuted(false);
      if (!requireAuth()) return;
      void toggleLike(product, { forceLike: true });
      setLikeBurstId(product.id);
      setTimeout(
        () =>
          setLikeBurstId((current) =>
            current === product.id ? null : current,
          ),
        650,
      );
      return;
    }
    lastTapAt.current = now;
    pendingTap.current = setTimeout(() => {
      pendingTap.current = null;
      setPaused((value) => !value);
      setMuted(false);
    }, 280);
  }

  async function toggleFollow(product: Product) {
    if (!requireAuth()) return;
    const current = liveProduct(product.id, product);
    const followed = Boolean(current.shop.followedByMe);
    const shopId = current.shop.id;
    patchFeed((item) => {
      if (item.shop.id !== shopId) return item;
      const was = Boolean(item.shop.followedByMe);
      return {
        ...item,
        shop: {
          ...item.shop,
          followedByMe: !followed,
          followersCount: Math.max(
            0,
            (item.shop.followersCount ?? 0) +
              (followed === was ? 0 : followed ? -1 : 1),
          ),
        },
      };
    });
    try {
      const data = await api<{
        followedByMe?: boolean;
        followersCount?: number;
      }>(`/api/shops/${current.shop.slug}/follow`, {
        method: followed ? "DELETE" : "POST",
      });
      patchFeed((item) => {
        if (item.shop.id !== shopId) return item;
        return {
          ...item,
          shop: {
            ...item.shop,
            followedByMe:
              typeof data.followedByMe === "boolean"
                ? data.followedByMe
                : !followed,
            followersCount:
              typeof data.followersCount === "number"
                ? data.followersCount
                : item.shop.followersCount,
          },
        };
      });
    } catch {
      patchFeed((item) => {
        if (item.shop.id !== shopId) return item;
        return {
          ...item,
          shop: {
            ...item.shop,
            followedByMe: followed,
            followersCount: current.shop.followersCount,
          },
        };
      });
    }
  }

  async function shareProduct(product: Product) {
    const link = `${apiOrigin()}/product/${product.id}`;
    await Share.share({ message: `${product.title}\n${link}` });
    if (!token) return;
    try {
      await api(`/api/products/${product.id}/share`, { method: "POST" });
      patchFeed((item) =>
        item.id === product.id
          ? { ...item, sharesCount: (item.sharesCount ?? 0) + 1 }
          : item,
      );
    } catch {
      showToast("Partage enregistré sur l'appareil seulement.", "info");
    }
  }

  function openLive(id: string) {
    router.push({ pathname: "/live/[id]", params: { id } });
  }

  async function onLivePress(
    product: Product,
    live: LiveTeaser | null | undefined,
  ) {
    if (live) {
      openLive(live.id);
      return;
    }
    if (!requireAuth()) return;
    const seller = isSellerOfShop(me.data, product.shop);
    if (!seller) {
      showToast(
        "Seul le vendeur de cette boutique peut lancer le live.",
        "info",
      );
      return;
    }
    if (startingLiveId) return;
    setStartingLiveId(product.id);
    try {
      const created = await api<{ live?: { id: string } }>(
        "/api/growth/lives",
        {
          method: "POST",
          body: JSON.stringify({
            productId: product.id,
            shopId: product.shop.id,
            title: product.title,
          }),
        },
      );
      await lives.refetch();
      if (created.live?.id) {
        openLive(created.live.id);
        return;
      }
      showToast("Live lancé.", "success");
    } catch (cause) {
      showToast(
        cause instanceof Error
          ? cause.message
          : "Impossible de lancer le live.",
        "error",
      );
    } finally {
      setStartingLiveId(null);
    }
  }

  const bottom = 72 + insets.bottom;

  const wantedHeaderPad = insets.top + 58;

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {tab === "search" ? (
        <View style={[styles.wantedPane, { paddingTop: wantedHeaderPad }]}>
          {wanted.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={c.emerald} />
            </View>
          ) : wanted.isError ? (
            <View style={styles.center}>
              <Text style={[styles.emptyTitle, { color: c.text }]}>
                Demandes indisponibles
              </Text>
              <Pressable
                style={styles.retry}
                onPress={() => void wanted.refetch()}
              >
                <Text style={styles.retryText}>Réessayer</Text>
              </Pressable>
            </View>
          ) : wantedItems.length === 0 ? (
            <View style={styles.center}>
              <Text style={[styles.emptyTitle, { color: c.text }]}>Vide</Text>
              <Text style={[styles.emptyText, { color: c.textMuted }]}>
                Aucune demande en attente.
              </Text>
            </View>
          ) : (
            <FlashList
              data={wantedItems}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: 100,
              }}
              renderItem={({ item }) => {
                const cover = item.images[0];
                const offerRows = item.offers ?? [];
                const offers = item._count?.offers ?? offerRows.length;
                const lastOffer = offerRows[0];
                const mine = Boolean(
                  me.data?.id && item.buyer?.id === me.data.id,
                );
                const followed = offers > 0;
                return (
                  <Pressable
                    onPress={() => router.push(`/wanted/${item.id}` as Href)}
                    style={[
                      styles.wantedCard,
                      {
                        backgroundColor: c.card,
                        borderColor: mine
                          ? "rgba(0,214,143,0.45)"
                          : "rgba(127,127,140,0.22)",
                      },
                    ]}
                  >
                    {cover ? (
                      <Image
                        source={{ uri: mediaUrl(cover) ?? cover }}
                        style={styles.wantedCover}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[styles.wantedCover, styles.wantedCoverEmpty]}
                      >
                        <Text style={{ color: c.textMuted }}>?</Text>
                      </View>
                    )}
                    <View style={styles.wantedBody}>
                      <View style={styles.wantedTitleRow}>
                        <Text
                          style={[styles.wantedTitle, { color: c.text }]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        {mine ? (
                          <View style={styles.wantedMine}>
                            <Text
                              style={styles.wantedMineText}
                              numberOfLines={1}
                            >
                              {"Ma\u00A0demande"}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.wantedBudget, { color: c.emerald }]}>
                        Budget {formatMoney(item.budgetCents, item.currency)}
                      </Text>
                      <Text style={[styles.wantedMeta, { color: c.textMuted }]}>
                        {item.condition === "USED"
                          ? "Occasion"
                          : "Neuf / magasin"}
                        {item.commune ? ` · ${item.commune}` : ""}
                      </Text>
                      <View style={styles.wantedStats}>
                        <View style={styles.wantedStat}>
                          <Ionicons
                            name="chatbubbles-outline"
                            size={14}
                            color={followed ? c.emerald : c.textMuted}
                          />
                          <Text
                            style={[
                              styles.wantedStatText,
                              { color: followed ? c.emerald : c.textMuted },
                            ]}
                          >
                            {offers} offre{offers > 1 ? "s" : ""}
                          </Text>
                        </View>
                        <View style={styles.wantedStat}>
                          <Ionicons
                            name={followed ? "pulse" : "pulse-outline"}
                            size={14}
                            color={followed ? c.emerald : c.textMuted}
                          />
                          <Text
                            style={[
                              styles.wantedStatText,
                              { color: followed ? c.emerald : c.textMuted },
                            ]}
                          >
                            {followed ? "Suivie" : "Pas encore suivie"}
                          </Text>
                        </View>
                      </View>
                      {mine && lastOffer ? (
                        <Text
                          style={[styles.wantedMeta, { color: c.emerald }]}
                          numberOfLines={1}
                        >
                          Dernière offre{" "}
                          {formatMoney(lastOffer.priceCents, item.currency)}
                          {lastOffer.status === "ACCEPTED"
                            ? " · acceptée"
                            : lastOffer.status === "DECLINED"
                              ? " · refusée"
                              : " · mise à jour"}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      ) : tab === "following" && !token ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Abonnements</Text>
          <Text style={styles.emptyText}>
            Connecte-toi pour voir le fil des boutiques que tu suis, comme Pour
            toi.
          </Text>
          <Pressable style={styles.retry} onPress={openAuth}>
            <Text style={styles.retryText}>Se connecter</Text>
          </Pressable>
        </View>
      ) : feed.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.emerald} />
        </View>
      ) : feed.isError ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Fil indisponible</Text>
          <Text style={styles.emptyText}>
            {feed.error instanceof Error ? feed.error.message : "Erreur réseau"}
          </Text>
          <Pressable style={styles.retry} onPress={() => void feed.refetch()}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.reel, { height }]}>
          <FlashList
            ref={listRef}
            key={tab}
            style={{ height, width }}
            data={feedRows}
            pagingEnabled={isReelTab}
            snapToInterval={isReelTab ? height : undefined}
            snapToAlignment="start"
            decelerationRate={isReelTab ? "fast" : "normal"}
            disableIntervalMomentum={isReelTab}
            bounces={false}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
            keyExtractor={(item) => item.key}
            drawDistance={height * 1.15}
            onMomentumScrollEnd={onMomentumScrollEnd}
            onEndReached={() => {
              if (feed.hasNextPage && !feed.isFetchingNextPage)
                void feed.fetchNextPage();
            }}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{
              itemVisiblePercentThreshold: 60,
              waitForInteraction: false,
            }}
            extraData={{
              active,
              paused,
              muted,
              focused,
              likeBurstId,
              expandedCaptionId,
              startingLiveId,
              liveStamp: lives.dataUpdatedAt,
              meId: me.data?.id,
              railEpoch,
              busyChallengeId,
            }}
            ListEmptyComponent={
              <View style={[styles.center, { paddingTop: 180 }]}>
                <Text style={[styles.emptyTitle, { color: c.text }]}>Vide</Text>
                <Text style={[styles.emptyText, { color: c.textMuted }]}>
                  La liste est vide.
                </Text>
              </View>
            }
            renderItem={({ item: row, index }) => {
              if (row.kind === "challenge") {
                return (
                  <View style={[styles.page, { height, width }]}>
                    <ChallengeCard
                      challenge={row.challenge}
                      template={row.template}
                      playing={index === active && focused && !paused}
                      busy={busyChallengeId === row.challenge.id}
                      bottomGutter={bottom}
                      onJoin={() =>
                        void joinChallenge(
                          row.challenge.id,
                          row.challenge.event?.id,
                        )
                      }
                    />
                  </View>
                );
              }
              const item = row.item;
              const live = matchOpenLive(lives.data?.lives, {
                productId: item.id,
                ownerUserId: item.shop.ownerUserId,
              });
              const shopSeller = isSellerOfShop(me.data, item.shop);
              const canSeeGoLive = Boolean(
                shopSeller ||
                me.data?.roles.includes("ADMIN") ||
                me.data?.roles.includes("OWNER"),
              );
              const liveOn = Boolean(live);
              const showGoLive = canSeeGoLive && !liveOn;
              const viewers = live
                ? (live.viewerCount ?? live.viewerPeak ?? 0)
                : (item.shop.followersCount ?? item.viewsCount ?? 0);
              const slides = mediaList(item.images);
              const promo =
                item.promoPercent && item.promoPercent > 0
                  ? item.promoPercent
                  : item.compareAtCents && item.compareAtCents > item.priceCents
                    ? Math.round(
                        (1 - item.priceCents / item.compareAtCents) * 100,
                      )
                    : null;
              const tendance =
                item.promoTier === "FLASH" ||
                item.promoTier === "FORTE" ||
                Boolean(promo);
              return (
                <View style={[styles.page, { height, width }]}>
                  <ReelGallery
                    urls={slides}
                    playing={
                      index === active &&
                      !paused &&
                      (focused || commentProduct?.id === item.id)
                    }
                    muted={muted || Boolean(item.soundtrack?.audioUrl)}
                    width={width}
                    height={height}
                    onTap={() => onMediaPress(item)}
                    dotsBottom={bottom + 100}
                    restartToken={item.id}
                    poster={coverOf(item.images)}
                  />
                  {item.soundtrack?.audioUrl &&
                  index === active &&
                  !paused &&
                  (focused || commentProduct?.id === item.id) ? (
                    <ReelSoundtrack
                      uri={
                        mediaUrl(item.soundtrack.audioUrl) ??
                        item.soundtrack.audioUrl
                      }
                      playing
                      muted={muted}
                    />
                  ) : null}
                  <LinearGradient
                    colors={[
                      "rgba(0,0,0,0.45)",
                      "transparent",
                      "rgba(0,0,0,0.72)",
                    ]}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <View style={styles.playCatch} pointerEvents="none">
                    {paused && index === active ? (
                      <Animated.View
                        entering={ZoomIn.springify().damping(14).stiffness(180)}
                        exiting={FadeOut.duration(140)}
                        style={styles.play}
                      >
                        <Ionicons name="play" size={34} color="#fff" />
                      </Animated.View>
                    ) : null}
                    {likeBurstId === item.id ? (
                      <Animated.View
                        entering={ZoomIn.springify().damping(11).stiffness(220)}
                        exiting={FadeOut.duration(180)}
                      >
                        <Ionicons
                          name="heart"
                          size={92}
                          color={colors.buyStart}
                        />
                      </Animated.View>
                    ) : null}
                  </View>
                  {tendance ? (
                    <View style={[styles.trend, { top: insets.top + 58 }]}>
                      <Ionicons name="flame" size={14} color="#ffb020" />
                      <Text style={styles.trendText}>Tendance</Text>
                    </View>
                  ) : null}
                  {showGoLive ? (
                    <Pressable
                      onPress={() => void onLivePress(item, live)}
                      disabled={startingLiveId === item.id}
                      style={[
                        styles.liveCluster,
                        { top: insets.top + 58 },
                        startingLiveId === item.id && styles.liveBusy,
                      ]}
                    >
                      <View
                        style={[
                          styles.liveBadge,
                          { backgroundColor: colors.live },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="access-point"
                          size={13}
                          color="#fff"
                        />
                        <Text style={styles.liveText}>LIVE</Text>
                      </View>
                      <View style={styles.viewerPill}>
                        <Ionicons name="eye" size={12} color="#fff" />
                        <Text style={styles.liveCount}>
                          {compactCount(viewers)}
                        </Text>
                      </View>
                    </Pressable>
                  ) : null}
                  <View style={[styles.rail, { bottom: bottom + 118 }]}>
                    <View style={styles.avatarWrap}>
                      <ShopLiveAvatar
                        live={liveOn}
                        logoUrl={item.shop.logoUrl}
                        name={item.shop.name}
                        size={44}
                        onPress={() => {
                          if (live) openLive(live.id);
                          else setShopProduct(item);
                        }}
                      />
                      {!item.shop.followedByMe ? (
                        <Pressable
                          style={styles.plusMini}
                          onPress={() => void toggleFollow(item)}
                        >
                          <Ionicons name="add" size={14} color="#fff" />
                        </Pressable>
                      ) : null}
                    </View>
                    <RailButton
                      icon="heart"
                      filled={item.likedByMe}
                      color={item.likedByMe ? colors.buyStart : "#fff"}
                      label={compactCount(item.likesCount)}
                      onPress={() => void toggleLike(item)}
                    />
                    <RailButton
                      icon="chatbubble"
                      label={compactCount(item.commentsCount)}
                      onPress={() =>
                        requireAuth() ? setCommentProduct(item) : undefined
                      }
                    />
                    <RailButton
                      icon="arrow-redo"
                      label={compactCount(item.sharesCount ?? 0)}
                      onPress={() => void shareProduct(item)}
                    />
                    <Pressable
                      style={styles.railBtn}
                      onPress={() =>
                        showToast(
                          "Les cadeaux s'envoient pendant le live.",
                          "info",
                        )
                      }
                    >
                      <MaterialCommunityIcons
                        name="gift"
                        size={26}
                        color="#ff8a3d"
                      />
                    </Pressable>
                  </View>
                  <View style={[styles.meta, { bottom: bottom + 100 }]}>
                    <View style={styles.shopCopy}>
                      <View style={styles.sellerRow}>
                        <View style={styles.shopFaceWrap}>
                          <ShopLiveAvatar
                            live={liveOn}
                            logoUrl={item.shop.logoUrl}
                            name={item.shop.name}
                            size={28}
                            onPress={() => {
                              if (live) openLive(live.id);
                              else setShopProduct(item);
                            }}
                          />
                        </View>
                        <Pressable
                          onPress={() => setShopProduct(item)}
                          style={styles.sellerHit}
                        >
                          <Text
                            style={styles.seller}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {item.shop.name.trim()}
                          </Text>
                          {item.shop.verified !== false ? (
                            <Ionicons
                              name="checkmark-circle"
                              size={15}
                              color="#3EC6FF"
                            />
                          ) : null}
                        </Pressable>
                        {!item.shop.followedByMe ? (
                          <Pressable
                            style={styles.follow}
                            onPress={() => void toggleFollow(item)}
                          >
                            <Text style={styles.followText} numberOfLines={1}>
                              Suivre
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <Text style={styles.viewsLine}>
                        {compactCount(item.viewsCount ?? item.likesCount ?? 0)}{" "}
                        vues
                      </Text>
                      {(item.colors?.length ?? 0) > 0 ||
                      (item.sizes?.length ?? 0) > 0 ? (
                        <View style={styles.optionsBlock}>
                          {(item.colors?.length ?? 0) > 0 ? (
                            <View style={styles.optionsRow}>
                              {(item.colors ?? []).slice(0, 5).map((swatch) => (
                                <View
                                  key={swatch}
                                  style={[
                                    styles.colorDot,
                                    { backgroundColor: colorHex(swatch) },
                                  ]}
                                />
                              ))}
                            </View>
                          ) : null}
                          {(item.sizes?.length ?? 0) > 0 ? (
                            <View style={styles.optionsRow}>
                              {(item.sizes ?? []).slice(0, 4).map((size) => (
                                <View key={size} style={styles.sizeChip}>
                                  <Text style={styles.sizeChipText}>
                                    {size}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                      {item.description ? (
                        <Pressable
                          onPress={() =>
                            setExpandedCaptionId((current) =>
                              current === item.id ? null : item.id,
                            )
                          }
                        >
                          <Text
                            style={styles.caption}
                            numberOfLines={
                              expandedCaptionId === item.id ? 6 : 2
                            }
                          >
                            {item.description.trim()}
                            {item.description.trim().length > 52 &&
                            expandedCaptionId !== item.id ? (
                              <Text style={styles.captionMore}> Plus</Text>
                            ) : null}
                          </Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        style={styles.soundRow}
                        onPress={() => setMuted((value) => !value)}
                      >
                        <Text style={styles.sound} numberOfLines={1}>
                          ♪{" "}
                          {item.soundtrack?.title ??
                            `Son original - ${item.shop.name}`}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                  <View style={[styles.card, { bottom: bottom + 8 }]}>
                    {coverOf(item.images) ? (
                      <Image
                        source={{ uri: coverOf(item.images) ?? undefined }}
                        style={styles.thumb}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.thumb} />
                    )}
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.reviews} numberOfLines={1}>
                        {compactCount(item.commentsCount)} avis
                        {"  "}
                        <Text
                          style={[
                            styles.cardStock,
                            { color: stockAlertColor(item) },
                          ]}
                        >
                          stock {stockFraction(item)}
                        </Text>
                      </Text>
                      <View style={styles.priceRow}>
                        <Text style={styles.price}>
                          {formatMoney(item.priceCents, item.currency)}
                        </Text>
                        {item.compareAtCents &&
                        item.compareAtCents > item.priceCents ? (
                          <Text style={styles.compare}>
                            {formatMoney(item.compareAtCents, item.currency)}
                          </Text>
                        ) : null}
                        {promo ? (
                          <Text style={styles.badge}>-{promo}%</Text>
                        ) : null}
                      </View>
                    </View>
                    <Pressable onPress={() => setBuyProduct(item)}>
                      <LinearGradient
                        colors={[colors.buyStart, colors.buyEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.buy}
                      >
                        <Ionicons name="cart" size={16} color="#fff" />
                        <Text style={styles.buyText}>Acheter</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                </View>
              );
            }}
          />
        </View>
      )}

      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 6,
            backgroundColor: tab === "search" ? c.background : "transparent",
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.headerRow}>
          <View style={styles.headerSide}>
            <Image
              source={require("@/assets/images/shipshop-logo.png")}
              style={styles.logo}
              contentFit="contain"
            />
            {!online ? (
              <View style={styles.offlinePill}>
                <Text style={styles.offlineText}>Hors-ligne</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.headerTabs}>
            <Pressable
              style={styles.tabSlot}
              onPress={() => {
                if (!token) {
                  openAuth();
                  return;
                }
                selectTab("following");
              }}
            >
              <Text
                style={[
                  styles.tab,
                  tab === "search" && { color: c.textMuted },
                  tab === "following" && styles.tabOn,
                ]}
                numberOfLines={1}
              >
                Abonnements
              </Text>
            </Pressable>
            <Pressable
              style={styles.tabSlot}
              onPress={() => selectTab("foryou")}
            >
              <Text
                style={[
                  styles.tab,
                  styles.tabCenter,
                  tab === "search" && { color: c.textMuted },
                  tab === "foryou" && styles.tabOn,
                ]}
                numberOfLines={1}
              >
                Pour toi
              </Text>
            </Pressable>
            <Pressable
              style={styles.tabSlot}
              onPress={() => selectTab("search")}
            >
              <Text
                style={[
                  styles.tab,
                  tab === "search" && { color: c.textMuted },
                  tab === "search" && styles.tabOn,
                ]}
                numberOfLines={1}
              >
                Je cherche
              </Text>
            </Pressable>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              hitSlop={8}
              onPress={() => (token ? setInboxOpen(true) : openAuth())}
              style={styles.iconHit}
            >
              <Ionicons
                name={token ? "notifications-outline" : "person-circle-outline"}
                size={24}
                color={tab === "search" ? c.text : "#fff"}
              />
              {token && inboxBadge > 0 ? (
                <View
                  style={[
                    styles.bellBadge,
                    inboxUrgent && styles.bellBadgeUrgent,
                  ]}
                >
                  <Text style={styles.bellBadgeText}>
                    {inboxUrgent
                      ? "!"
                      : inboxBadge > 9
                        ? "9+"
                        : compactCount(inboxBadge)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              hitSlop={8}
              onPress={() =>
                token ? router.push("/profile" as Href) : openAuth()
              }
              style={styles.iconHit}
            >
              <Ionicons
                name="settings-outline"
                size={22}
                color={tab === "search" ? c.text : "#fff"}
              />
            </Pressable>
          </View>
        </View>
      </View>
      <NotificationsSheet
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
      />
      <CommentsSheet
        product={commentProduct}
        onClose={() => setCommentProduct(null)}
        onPosted={(productId) => {
          patchFeed((item) =>
            item.id === productId
              ? { ...item, commentsCount: item.commentsCount + 1 }
              : item,
          );
        }}
      />
      <BuySheet
        product={buyProduct}
        onClose={() => setBuyProduct(null)}
        onAdded={() => undefined}
      />
      <ShopProfileSheet
        shop={
          shopProduct
            ? (products.find((item) => item.id === shopProduct.id)?.shop ??
              shopProduct.shop)
            : null
        }
        onClose={() => setShopProduct(null)}
        onFollow={() => {
          if (shopProduct) void toggleFollow(shopProduct);
        }}
      />
    </View>
  );
}

function RailButton({
  icon,
  label,
  filled,
  color = "#fff",
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  filled?: boolean;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.railBtn} onPress={onPress}>
      <Ionicons
        name={filled ? icon : (`${icon}-outline` as typeof icon)}
        size={28}
        color={color}
      />
      <Text style={[styles.railLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  reel: {
    overflow: "hidden",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  page: {
    overflow: "hidden",
  },
  media: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700" },
  emptyText: { textAlign: "center" },
  wantedPane: { flex: 1 },
  wantedCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  wantedCover: {
    width: 88,
    height: 88,
    borderRadius: 16,
    backgroundColor: "rgba(127,127,140,0.16)",
  },
  wantedCoverEmpty: { alignItems: "center", justifyContent: "center" },
  wantedBody: { flex: 1, justifyContent: "center", gap: 4, minWidth: 0 },
  wantedTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  wantedTitle: {
    flex: 1,
    minWidth: 0,
    fontWeight: "800",
    fontSize: 16,
  },
  wantedMine: {
    flexShrink: 0,
    marginLeft: "auto",
    backgroundColor: "rgba(0,214,143,0.18)",
    borderColor: "rgba(0,214,143,0.55)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  wantedMineText: {
    color: colors.emerald,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
  wantedBudget: { fontWeight: "700", fontSize: 13 },
  wantedMeta: { fontSize: 12 },
  wantedStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 4,
  },
  wantedStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  wantedStatText: { fontSize: 12, fontWeight: "700" },
  retry: {
    marginTop: 8,
    backgroundColor: colors.emeraldDeep,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: { color: "#fff", fontWeight: "700" },
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20 },
  offlinePill: {
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  offlineText: { color: "#fcd34d", fontSize: 10, fontWeight: "700" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerSide: {
    width: 84,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingLeft: 4,
  },
  headerActions: {
    width: 84,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
  },
  iconHit: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.buyStart,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadgeUrgent: { backgroundColor: "#f59e0b" },
  bellBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  logo: { width: 28, height: 28 },
  headerTabs: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 4,
  },
  tabSlot: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
  },
  tab: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  tabCenter: {
    fontSize: 16,
  },
  tabOn: {
    color: colors.emerald,
    borderBottomWidth: 2,
    borderBottomColor: colors.emerald,
  },
  trend: {
    position: "absolute",
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trendText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  liveCluster: {
    position: "absolute",
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveBusy: { opacity: 0.7 },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  viewerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(12,12,16,0.72)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  liveText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.3,
  },
  liveCount: { color: "#fff", fontSize: 11, fontWeight: "700" },
  playCatch: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  play: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  rail: {
    position: "absolute",
    right: 4,
    alignItems: "center",
    gap: 8,
    width: 52,
  },
  railBtn: { alignItems: "center", width: 52 },
  railLabel: { color: "#fff", fontSize: 11, fontWeight: "700" },
  avatarWrap: { marginBottom: 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: "#fff",
  },
  plusMini: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.emerald,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { position: "absolute", left: 12, right: 58 },
  shopCopy: { minWidth: 0, gap: 3 },
  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  shopFaceWrap: { flexShrink: 0 },
  shopFace: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#222",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  shopFaceFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.emeraldDeep,
  },
  shopFaceLetter: { color: "#fff", fontWeight: "800", fontSize: 12 },
  sellerHit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
    minWidth: 90,
    maxWidth: "58%",
  },
  seller: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
    flexShrink: 1,
    minWidth: 90,
  },
  viewsLine: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 34,
    marginTop: 2,
  },
  optionsBlock: {
    marginLeft: 34,
    marginTop: 4,
    gap: 6,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  sizeChip: {
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  sizeChipText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  follow: {
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  followText: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 12,
  },
  caption: {
    color: "#fff",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  captionMore: { color: "#fff", fontWeight: "800" },
  soundRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 1,
  },
  sound: { color: "rgba(255,255,255,0.88)", fontSize: 12, flex: 1 },
  card: {
    position: "absolute",
    left: 10,
    right: 10,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  thumb: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#333",
    overflow: "hidden",
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { color: "#fff", fontWeight: "700" },
  cardStock: { fontWeight: "800" },
  reviews: { color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 2 },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  price: { color: colors.emerald, fontWeight: "800" },
  compare: {
    color: "rgba(255,255,255,0.55)",
    textDecorationLine: "line-through",
    fontSize: 11,
  },
  badge: {
    color: colors.emerald,
    backgroundColor: "rgba(0,214,143,0.18)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    includeFontPadding: false,
  },
  buy: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  buyText: { color: "#fff", fontWeight: "800" },
});
