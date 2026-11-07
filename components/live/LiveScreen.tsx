import { Ionicons } from "@expo/vector-icons";
import { useKeepAwake } from "expo-keep-awake";
import {
    keepPreviousData,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { safeBack } from "@/src/nav";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    AppState,
    Keyboard,
    Modal,
    Platform,
    Pressable,
    Share,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BuySheet } from "@/components/feed/Sheets";
import { LiveComments } from "@/components/live/LiveComments";
import { LiveGiftSheet } from "@/components/live/LiveGiftSheet";
import { LiveGuestQueue } from "@/components/live/LiveGuestQueue";
import { LiveKitGate } from "@/components/live/LiveKitGate";
import { LiveLikeRise, type LiveFx } from "@/components/live/LiveLikeRise";
import {
    LiveCatalogSync,
    LiveHostAvButtons,
    LiveKitVideo,
    LiveScreenShareBanner,
    LiveScreenShareHost,
} from "@/components/live/LiveMedia";
import { LiveProductsSheet } from "@/components/live/LiveProductsSheet";
import { LiveViewersSheet } from "@/components/live/LiveViewersSheet";
import { LiveWaiting } from "@/components/live/LiveWaiting";
import { api, ApiError, apiOrigin, apiPayment, mediaUrl } from "@/src/api";
import { compactCount, formatMoney } from "@/src/format";
import {
    formatLiveClock,
    type LiveChat,
    type LiveDetail,
    type LiveGuest,
    type LiveSfuToken,
    type LiveViewer,
} from "@/src/live";
import { isLiveRtcAvailable } from "@/src/live-rtc";
import {
    LIVE_STAGE_LAYOUTS,
    normalizeStageLayout,
} from "@/src/live-stage-layout";
import { isSellerOfShop, useMe } from "@/src/me";
import {
    clearPaymentIdempotencyKey,
    paymentIdempotencyKey,
} from "@/src/pay-idempotency";
import { useSession } from "@/src/session";
import { colors } from "@/src/theme";
import { showToast } from "@/src/toast";
import type { Product } from "@/src/types";

function LiveKeepAwake() {
  useKeepAwake("shipshop-live");
  return null;
}

export function LiveScreen({ liveId }: { liveId: string }) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const me = useMe();
  const [chat, setChat] = useState("");
  const [busy, setBusy] = useState(false);
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [peerCatalog, setPeerCatalog] = useState<{
    open: boolean;
    presentedProductId: string | null;
    scrollY: number;
  }>({ open: false, presentedProductId: null, scrollY: 0 });
  const [localPresented, setLocalPresented] = useState<string | null>(null);
  const [localScroll, setLocalScroll] = useState(0);
  const [giftOpen, setGiftOpen] = useState(false);
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [localViewers, setLocalViewers] = useState<LiveViewer[]>([]);
  const [localViewerCount, setLocalViewerCount] = useState<number | null>(null);
  const [localQualifiedCount, setLocalQualifiedCount] = useState(0);
  const [hostDenied, setHostDenied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [chatVisible, setChatVisible] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [localChats, setLocalChats] = useState<LiveChat[]>([]);
  const [stageFx, setStageFx] = useState<LiveFx[]>([]);
  const skipLikeFx = useRef(0);
  const skipGiftFx = useRef(0);
  const lastTap = useRef(0);
  const prevPending = useRef(0);
  const sessionKey = token ?? "guest";
  const rtcAvailable = isLiveRtcAvailable();

  const liveQuery = useQuery({
    queryKey: ["live", liveId, sessionKey],
    queryFn: () => {
      const seen = queryClient.getQueryData(["live", liveId, sessionKey]);
      const qs = seen ? "" : "?countView=1";
      return api<{ live: LiveDetail }>(`/api/growth/lives/${liveId}${qs}`);
    },
    refetchInterval: (query) =>
      query.state.data?.live?.status === "ENDED" ? false : 1200,
  });

  const live = liveQuery.data?.live;
  const shop = live?.product?.shop;
  const isHost = Boolean(
    !hostDenied &&
    live &&
    ((me.data?.id && live.user?.id === me.data.id) ||
      (shop?.id &&
        isSellerOfShop(me.data, {
          id: shop.id,
          ownerUserId: live.user?.id,
        }))),
  );
  const ended = live?.status === "ENDED";
  const paused = live?.status === "PAUSED";
  const hostPending = Boolean(token && me.isLoading && !hostDenied);
  const showPaused = paused && !isHost && !hostPending;
  const shopName = live?.product?.shop?.name?.trim() || "Boutique";
  const shopAvatar = mediaUrl(live?.product?.shop?.logoUrl);

  const sfuQuery = useQuery({
    queryKey: ["live-sfu", liveId, sessionKey],
    enabled: Boolean(live && !ended),
    staleTime: 4 * 60_000,
    placeholderData: keepPreviousData,
    retry: 2,
    queryFn: () => api<LiveSfuToken>(`/api/growth/lives/${liveId}/sfu-token`),
  });
  const sfu = sfuQuery.data?.token && sfuQuery.data.url ? sfuQuery.data : null;
  const sfuReady = Boolean(sfu);
  const canPublish = Boolean(isHost || sfu?.canPublish);

  const spawnFx = useCallback((kind: LiveFx["kind"], amountCents?: number) => {
    const id = `fx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setStageFx((prev) => [...prev.slice(-3), { id, kind, amountCents }]);
    setTimeout(() => {
      setStageFx((prev) => prev.filter((row) => row.id !== id));
    }, 2100);
  }, []);

  const applyLive = useCallback(
    (next: LiveDetail) => {
      queryClient.setQueryData<{ live: LiveDetail }>(
        ["live", liveId, sessionKey],
        (prev) => {
          const before = prev?.live;
          if (before) {
            const giftId = next.lastGiftBurst?.id ?? null;
            if (
              giftId &&
              giftId !== (before.lastGiftBurst?.id ?? null) &&
              Date.now() - skipGiftFx.current > 900
            ) {
              spawnFx("gift", next.lastGiftBurst?.amountCents ?? 0);
            }
            const likeDelta = (next.likeCount ?? 0) - (before.likeCount ?? 0);
            if (likeDelta > 0 && Date.now() - skipLikeFx.current > 900) {
              spawnFx("like");
            }
          }
          return {
            live: {
              ...(prev?.live ?? next),
              ...next,
              user: next.user ?? prev?.live.user,
              product: next.product ?? prev?.live.product,
              chats: Array.isArray(next.chats)
                ? next.chats
                : (prev?.live.chats ?? next.chats),
              guests: Array.isArray(next.guests)
                ? next.guests
                : (prev?.live.guests ?? next.guests),
              myGuest:
                next.myGuest !== undefined
                  ? next.myGuest
                  : (prev?.live.myGuest ?? next.myGuest),
              overlays: Array.isArray(next.overlays)
                ? next.overlays
                : (prev?.live.overlays ?? next.overlays),
              catalogOpen:
                typeof next.catalogOpen === "boolean"
                  ? next.catalogOpen
                  : Boolean(prev?.live.catalogOpen),
              presentedProductId:
                next.presentedProductId !== undefined
                  ? next.presentedProductId
                  : (prev?.live.presentedProductId ?? null),
              catalogScrollY:
                typeof next.catalogScrollY === "number"
                  ? next.catalogScrollY
                  : (prev?.live.catalogScrollY ?? 0),
              catalogProducts: Array.isArray(next.catalogProducts)
                ? next.catalogProducts
                : (prev?.live.catalogProducts ?? next.catalogProducts),
              lastGiftBurst:
                next.lastGiftBurst !== undefined
                  ? next.lastGiftBurst
                  : (prev?.live.lastGiftBurst ?? null),
            },
          };
        },
      );
    },
    [liveId, queryClient, sessionKey, spawnFx],
  );

  const hostPost = useCallback(
    async (body: Record<string, unknown>) => {
      try {
        const data = await api<{
          live?: LiveDetail;
          guests?: LiveGuest[];
          guest?: LiveGuest;
        }>(`/api/growth/lives/${liveId}`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (data.live) applyLive(data.live);
        if (data.guests || data.guest) {
          queryClient.setQueryData<{ live: LiveDetail }>(
            ["live", liveId, sessionKey],
            (prev) =>
              prev
                ? {
                    live: {
                      ...prev.live,
                      guests: data.guests ?? prev.live.guests,
                      myGuest:
                        body.action === "guest_accept" ||
                        body.action === "guest_refuse"
                          ? prev.live.myGuest
                          : (data.guest ?? prev.live.myGuest),
                    },
                  }
                : prev,
          );
        }
        return true;
      } catch (cause) {
        if (
          cause instanceof ApiError &&
          (String(body.action ?? "").startsWith("guest_") ||
            body.action === "catalog" ||
            body.action === "stage_layout" ||
            body.action === "guest_join_lock")
        ) {
          showToast(cause.message, "error");
          return false;
        }
        if (cause instanceof ApiError && cause.status === 403) {
          setHostDenied(true);
        }
        return false;
      }
    },
    [applyLive, liveId, queryClient, sessionKey],
  );

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) => setKeyboardHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (!ended) return;
    void queryClient.invalidateQueries({ queryKey: ["lives"] });
  }, [ended, queryClient]);

  useEffect(() => {
    if (!live?.startedAt) return;
    const start = new Date(live.startedAt).getTime();
    const beat = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    beat();
    const timer = setInterval(beat, 1000);
    return () => clearInterval(timer);
  }, [live?.startedAt]);

  useEffect(() => {
    if (!isHost || ended) return;
    const beat = () => {
      void hostPost({ action: "heartbeat", reason: "auto_resume" });
    };
    beat();
    const timer = setInterval(beat, 15_000);
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") beat();
    });
    return () => {
      clearInterval(timer);
      app.remove();
    };
  }, [ended, hostPost, isHost]);

  // Présence viewers — compte exact + liste (host)
  useEffect(() => {
    if (!live || ended) return;
    let cancelled = false;
    const peerKey = me.data?.id ?? `anon:${sessionKey}`;
    const ping = async () => {
      try {
        const data = await api<{
          viewerCount?: number;
          qualifiedViewerCount?: number;
          viewers?: LiveViewer[];
        }>(`/api/growth/lives/${liveId}/presence`, {
          method: "POST",
          body: JSON.stringify({
            peerKey,
            displayName: "Viewer",
          }),
        });
        if (cancelled) return;
        if (typeof data.viewerCount === "number") {
          setLocalViewerCount(data.viewerCount);
        }
        if (typeof data.qualifiedViewerCount === "number") {
          setLocalQualifiedCount(data.qualifiedViewerCount);
        }
        if (data.viewers) setLocalViewers(data.viewers);
      } catch {
        /* offline / table absente */
      }
    };
    void ping();
    const timer = setInterval(() => void ping(), 20_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      void api(`/api/growth/lives/${liveId}/presence`, {
        method: "POST",
        body: JSON.stringify({ action: "leave", peerKey }),
      }).catch(() => undefined);
    };
  }, [ended, live?.id, liveId, me.data?.id, sessionKey]);

  const wasOnStage = useRef(false);
  useEffect(() => {
    const onStage = live?.myGuest?.status === "ON_STAGE";
    if (isHost || !onStage || wasOnStage.current) {
      wasOnStage.current = onStage;
      return;
    }
    wasOnStage.current = true;
    void queryClient.invalidateQueries({
      queryKey: ["live-sfu", liveId, sessionKey],
    });
  }, [isHost, live?.myGuest?.status, liveId, queryClient, sessionKey]);

  const pendingCount =
    live?.guests?.filter((row) => row.status === "PENDING").length ?? 0;
  useEffect(() => {
    if (!isHost) return;
    if (pendingCount > prevPending.current) {
      showToast("Quelqu’un veut monter au live", "info");
    }
    prevPending.current = pendingCount;
  }, [isHost, pendingCount]);

  async function sendChat() {
    const body = chat.trim();
    if (!body) return;
    if (!token) {
      openAuth();
      return;
    }
    setBusy(true);
    try {
      await api(`/api/growth/lives/${liveId}`, {
        method: "POST",
        body: JSON.stringify({ action: "chat", body }),
      });
      setChat("");
      setLocalChats((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          body,
          user: {
            id: me.data?.id ?? "me",
            name: isHost ? shopName : "Toi",
          },
        },
      ]);
      await liveQuery.refetch();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Message impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendLike() {
    if (!token) {
      openAuth();
      return;
    }
    if (isHost) return;
    skipLikeFx.current = Date.now();
    spawnFx("like");
    try {
      const data = await api<{ likeCount?: number }>(
        `/api/growth/lives/${liveId}`,
        {
          method: "POST",
          body: JSON.stringify({ action: "like" }),
        },
      );
      if (typeof data.likeCount === "number") {
        queryClient.setQueryData<{ live: LiveDetail }>(
          ["live", liveId, sessionKey],
          (prev) =>
            prev ? { live: { ...prev.live, likeCount: data.likeCount } } : prev,
        );
      }
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "J’aime impossible",
        "error",
      );
    }
  }

  async function sendGift(amountCents: number) {
    if (!token) {
      openAuth();
      return;
    }
    const intent = `live-gift-${liveId}`;
    setBusy(true);
    try {
      const key = await paymentIdempotencyKey(intent);
      await apiPayment(`/api/growth/lives/${liveId}`, {
        method: "POST",
        body: JSON.stringify({
          action: "gift",
          amountCents,
          kind: "CUSTOM",
        }),
        idempotencyKey: key,
        replayScope: "GIFT",
      });
      await clearPaymentIdempotencyKey(intent);
      setGiftOpen(false);
      skipGiftFx.current = Date.now();
      spawnFx("gift", amountCents);
      await liveQuery.refetch();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Cadeau impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function endLive() {
    setBusy(true);
    try {
      await api(`/api/growth/lives/${liveId}`, {
        method: "POST",
        body: JSON.stringify({ action: "end" }),
      });
      void queryClient.invalidateQueries({ queryKey: ["lives"] });
      Keyboard.dismiss();
      router.replace("/");
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Fin du live impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  function goHome() {
    Keyboard.dismiss();
    safeBack();
  }

  async function onStopPress() {
    if (busy || hostPending) return;
    if (isHost && !ended) {
      await endLive();
      return;
    }
    goHome();
  }

  async function shareLive() {
    try {
      await Share.share({
        message: `${live?.user?.name ?? "Créateur"} est en live — ${live?.title ?? "ShipShop"}\n${apiOrigin()}/live/${liveId}`,
      });
    } catch {
      /* cancelled */
    }
  }

  const onRemoteCatalog = useCallback(
    (next: {
      open: boolean;
      presentedProductId: string | null;
      scrollY?: number;
    }) => {
      setPeerCatalog((prev) => ({
        open: next.open,
        presentedProductId: next.presentedProductId,
        scrollY: typeof next.scrollY === "number" ? next.scrollY : prev.scrollY,
      }));
    },
    [],
  );

  const sharedCatalog = Boolean(live?.catalogOpen) || peerCatalog.open;
  const presentedProductId = isHost
    ? (localPresented ?? live?.presentedProductId ?? null)
    : peerCatalog.open
      ? peerCatalog.presentedProductId
      : (live?.presentedProductId ?? null);
  const catalogScrollY = isHost
    ? localScroll
    : peerCatalog.open
      ? peerCatalog.scrollY
      : (live?.catalogScrollY ?? 0);

  useEffect(() => {
    if (!isHost || !bagOpen) return;
    const timer = setTimeout(() => {
      void hostPost({ action: "catalog", open: true, scrollY: localScroll });
    }, 450);
    return () => clearTimeout(timer);
  }, [bagOpen, hostPost, isHost, localScroll]);

  const catalogSheetOpen = isHost ? bagOpen : sharedCatalog;

  const featured: Product | null = live?.product
    ? {
        id: live.product.id,
        title: live.product.title,
        description: live.product.description ?? null,
        priceCents: live.product.priceCents,
        currency: live.product.currency,
        images: live.product.images,
        colors: [],
        sizes: [],
        likesCount: 0,
        commentsCount: 0,
        likedByMe: false,
        shop: {
          id: live.product.shop?.id ?? "",
          name: live.product.shop?.name ?? "",
          slug: live.product.shop?.slug ?? "",
        },
      }
    : null;

  if (liveQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#00D68F" />
      </View>
    );
  }

  if (!live) {
    return (
      <View style={styles.center}>
        <Text style={styles.endedTitle}>Live introuvable</Text>
        <Pressable onPress={() => safeBack()}>
          <Text style={styles.link}>Retour{"\u00A0"}</Text>
        </Pressable>
      </View>
    );
  }

  const serverChats = live.chats ?? [];
  const chats = [
    ...serverChats,
    ...localChats.filter(
      (row) =>
        !serverChats.some(
          (item) => item.body === row.body && item.user.id === row.user.id,
        ),
    ),
  ];
  const composerBottom = keyboardHeight > 0 ? keyboardHeight : 0;
  const room = (
    <>
      {live && !ended ? <LiveKeepAwake /> : null}
      <View style={styles.root} collapsable={false}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        {shopAvatar ? (
          <Image source={{ uri: shopAvatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatar} />
        )}
        <Text style={styles.shopName} numberOfLines={1}>
          {shopName}
        </Text>
        <Pressable
          onPress={() => void onStopPress()}
          accessibilityRole="button"
          accessibilityLabel={
            ended
              ? "Live terminé, quitter"
              : isHost
                ? "Arrêter le live"
                : "Quitter le live"
          }
          style={[
            styles.livePill,
            showPaused && { backgroundColor: "#F59E0B" },
            ended && { backgroundColor: "rgba(255,255,255,0.28)" },
          ]}
        >
          <Ionicons name={ended ? "radio" : "stop"} size={11} color="#fff" />
          <Text style={styles.livePillText}>{ended ? "FINI" : "STOP"}</Text>
        </Pressable>
        <View style={styles.metaPill}>
          <Ionicons name="time-outline" size={12} color="#fff" />
          <Text style={styles.metaText}>{formatLiveClock(elapsed)}</Text>
        </View>
        <Pressable
          style={styles.metaPill}
          onPress={() => setViewersOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Voir les spectateurs"
        >
          <Ionicons name="eye" size={12} color="#fff" />
          <Text style={styles.metaText}>
            {compactCount(
              localViewerCount ?? live.viewerCount ?? live.viewerPeak ?? 0,
            )}
          </Text>
        </Pressable>
      </View>

      {isHost && !ended ? (
        <View
          style={[styles.guestQueue, { top: insets.top + 58 }]}
          pointerEvents="box-none"
        >
          <LiveGuestQueue
            pending={(live.guests ?? []).filter(
              (row) => row.status === "PENDING",
            )}
            busy={busy}
            onAccept={(guestId) => {
              void (async () => {
                setBusy(true);
                const ok = await hostPost({ action: "guest_accept", guestId });
                setBusy(false);
                if (ok) showToast("Invité sur scène", "success");
              })();
            }}
            onRefuse={(guestId) => {
              void (async () => {
                setBusy(true);
                await hostPost({ action: "guest_refuse", guestId });
                setBusy(false);
              })();
            }}
          />
        </View>
      ) : null}

      {ended ? (
        <View style={styles.statusBox} pointerEvents="box-none">
          <Text style={styles.statusTitle}>Live terminé</Text>
          <Text style={styles.statusBody}>
            {live.statusMessage ?? "Le diffuseur a arrêté le live."}
          </Text>
          <Pressable style={styles.resume} onPress={goHome}>
            <Text style={styles.resumeText}>Quitter</Text>
          </Pressable>
        </View>
      ) : null}

      {showPaused ? (
        <View style={styles.statusBox} pointerEvents="box-none">
          <Text style={styles.statusTitle}>Live en pause</Text>
          {live.statusMessage ? (
            <Text style={styles.statusBody}>{live.statusMessage}</Text>
          ) : null}
        </View>
      ) : null}

      {!ended && token && sfuQuery.isError ? (
        <View style={styles.statusBox} pointerEvents="box-none">
          <Text style={styles.statusTitle}>Vidéo et son indisponibles</Text>
          <Text style={styles.statusBody}>
            {sfuQuery.error instanceof Error
              ? sfuQuery.error.message
              : "Réessaie la connexion au live"}
          </Text>
        </View>
      ) : null}
      {!ended && token && sfu && !rtcAvailable ? (
        <View style={styles.statusBox} pointerEvents="box-none">
          <Text style={styles.statusTitle}>Caméra et micro indisponibles</Text>
          <Text style={styles.statusBody}>
            Relance le build de développement pour activer la vidéo
          </Text>
        </View>
      ) : null}
      {paused && isHost && !ended ? (
        <View style={styles.resumeWrap} pointerEvents="box-none">
          <Pressable
            style={styles.resume}
            onPress={() => void hostPost({ action: "resume" })}
          >
            <Ionicons name="play" size={16} color="#05140F" />
            <Text style={styles.resumeText}>Reprendre</Text>
          </Pressable>
        </View>
      ) : null}

      {!token && !ended && !sfuReady ? (
        <Pressable style={styles.authBanner} onPress={openAuth}>
          <Text style={styles.authBannerText}>
            Connecte-toi pour voir la vidéo et entendre le son
          </Text>
        </Pressable>
      ) : null}

      {sfuQuery.isError && !ended ? (
        <View style={styles.authBanner}>
          <Text style={styles.authBannerText}>
            Vidéo indisponible — le chat et la boutique restent actifs
          </Text>
        </View>
      ) : null}

      {isHost && canPublish && !ended ? (
        <LiveScreenShareBanner enabled liveId={liveId} />
      ) : null}

      <Pressable
        style={styles.stage}
        onPress={() => {
          const now = Date.now();
          if (now - lastTap.current < 280) {
            lastTap.current = 0;
            void sendLike();
            return;
          }
          lastTap.current = now;
        }}
      >
        {sfuReady ? (
          <LiveKitVideo
            isHost={isHost}
            hostUserId={live.user?.id}
            cameraOn={live.cameraOn !== false}
            hostAvatar={shopAvatar}
            ended={ended}
            paused={paused}
            stageLayout={live.stageLayout}
            onKickPlayback={() => void sfuQuery.refetch()}
          />
        ) : ended || paused ? (
          <View style={styles.stage} />
        ) : (
          <LiveWaiting
            avatar={shopAvatar}
            isHost={isHost}
            onRetry={() => void sfuQuery.refetch()}
          />
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0.35)", "transparent", "rgba(0,0,0,0.4)"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </Pressable>

      <View
        style={[
          styles.bottom,
          {
            bottom: composerBottom,
            paddingBottom: composerBottom > 0 ? 8 : insets.bottom + 8,
          },
        ]}
        pointerEvents="box-none"
      >
        {chatVisible ? (
          <LiveComments chats={chats} hostUserId={live.user?.id} />
        ) : null}

        <View style={styles.composerRow}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => setChatVisible((value) => !value)}
          >
            <Ionicons
              name={chatVisible ? "chatbubble-ellipses" : "chatbubble-outline"}
              size={18}
              color="#fff"
            />
          </Pressable>
          <TextInput
            value={chat}
            onChangeText={setChat}
            placeholder="Commenter…"
            placeholderTextColor="rgba(255,255,255,0.45)"
            style={styles.input}
            editable={!ended && !busy}
            onSubmitEditing={() => void sendChat()}
            returnKeyType="send"
          />
          <Pressable onPress={() => void sendChat()} hitSlop={8}>
            <Ionicons name="send" size={18} color="#00D68F" />
          </Pressable>
        </View>
      </View>

      <View
        style={[
          styles.rail,
          {
            bottom: (composerBottom > 0 ? composerBottom : insets.bottom) + 118,
          },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          style={styles.railBtn}
          onPress={() => {
            setBagOpen(true);
            if (isHost) void hostPost({ action: "catalog", open: true });
          }}
        >
          <Ionicons name="bag-handle" size={20} color="#fff" />
        </Pressable>
        {!isHost ? (
          <Pressable style={styles.railBtn} onPress={() => void sendLike()}>
            <Ionicons name="heart" size={22} color="#FF5BA0" />
            <Text style={styles.railCount}>
              {compactCount(live.likeCount ?? 0)}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.railBtn}>
            <Ionicons name="heart" size={20} color="#FF5BA0" />
            <Text style={styles.railCount}>
              {compactCount(live.likeCount ?? 0)}
            </Text>
          </View>
        )}
        {!isHost ? (
          <Pressable
            style={styles.railBtn}
            onPress={() => {
              if (!token) {
                openAuth();
                return;
              }
              setGiftOpen(true);
            }}
          >
            <Ionicons name="gift" size={20} color="#7dffb3" />
          </Pressable>
        ) : (
          <View style={styles.railBtn}>
            <Ionicons name="gift" size={18} color="#7dffb3" />
            <Text style={styles.railCount}>
              {formatMoney(live.giftCents ?? 0)}
            </Text>
          </View>
        )}
        {!isHost && !ended ? (
          <Pressable
            style={[
              styles.railBtn,
              live.myGuest?.status === "PENDING" && styles.railBtnWait,
              live.myGuest?.status === "ON_STAGE" && styles.railBtnOn,
              live.guestJoinLocked &&
                live.myGuest?.status !== "ON_STAGE" &&
                live.myGuest?.status !== "PENDING" &&
                styles.railBtnWait,
            ]}
            onPress={() => {
              if (!token) {
                openAuth();
                return;
              }
              const status = live.myGuest?.status;
              if (
                live.guestJoinLocked &&
                status !== "PENDING" &&
                status !== "ON_STAGE"
              ) {
                showToast(
                  "Live host-only — le diffuseur a fermé les montées",
                  "info",
                );
                return;
              }
              void (async () => {
                setBusy(true);
                if (status === "PENDING") {
                  await hostPost({ action: "guest_cancel" });
                  showToast("Demande annulée", "info");
                } else if (status === "ON_STAGE") {
                  await hostPost({ action: "guest_leave" });
                  showToast("Hors scène", "info");
                } else {
                  const ok = await hostPost({ action: "guest_request" });
                  if (ok) showToast("Demande envoyée au diffuseur", "success");
                }
                setBusy(false);
                await liveQuery.refetch();
              })();
            }}
          >
            <Ionicons
              name={
                live.myGuest?.status === "ON_STAGE"
                  ? "mic"
                  : live.myGuest?.status === "PENDING"
                    ? "hourglass"
                    : live.guestJoinLocked
                      ? "lock-closed"
                      : "person-add"
              }
              size={20}
              color={
                live.myGuest?.status === "PENDING" ||
                (live.guestJoinLocked && live.myGuest?.status !== "ON_STAGE")
                  ? "#FBBF24"
                  : "#fff"
              }
            />
          </Pressable>
        ) : null}
        <Pressable style={styles.railBtn} onPress={() => void shareLive()}>
          <Ionicons name="share-social" size={20} color="#fff" />
        </Pressable>
        {canPublish ? (
          <>
            <LiveHostAvButtons
              onCamera={(enabled) => {
                void hostPost({ action: "camera", cameraOn: enabled });
              }}
              onMic={(enabled) => {
                void hostPost({ action: "mic", micOn: enabled });
              }}
            />
            {isHost ? <LiveScreenShareHost enabled liveId={liveId} /> : null}
            {isHost ? (
              <Pressable
                style={[
                  styles.railBtn,
                  live.guestJoinLocked && styles.railBtnWait,
                ]}
                onPress={() => {
                  void (async () => {
                    setBusy(true);
                    const locked = !live.guestJoinLocked;
                    const ok = await hostPost({
                      action: "guest_join_lock",
                      locked,
                    });
                    setBusy(false);
                    if (ok) {
                      showToast(
                        locked
                          ? "Montées fermées — live host-only"
                          : "Montées ouvertes — viewers peuvent demander",
                        "info",
                      );
                      await liveQuery.refetch();
                    }
                  })();
                }}
                accessibilityLabel={
                  live.guestJoinLocked
                    ? "Ouvrir les montées viewers"
                    : "Fermer les montées (host-only)"
                }
              >
                <Ionicons
                  name={live.guestJoinLocked ? "lock-closed" : "lock-open"}
                  size={20}
                  color={live.guestJoinLocked ? "#FBBF24" : "#fff"}
                />
              </Pressable>
            ) : null}
            {isHost ? (
              <Pressable
                style={styles.railBtn}
                onPress={() => setLayoutPickerOpen(true)}
                accessibilityLabel="Disposition scène"
              >
                <Ionicons name="grid-outline" size={20} color="#fff" />
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>
      <LiveLikeRise events={stageFx} />
      <LiveCatalogSync
        isHost={isHost}
        open={catalogSheetOpen}
        presentedProductId={presentedProductId}
        scrollY={catalogScrollY}
        onRemote={onRemoteCatalog}
      />

      <LiveProductsSheet
        open={catalogSheetOpen}
        liveId={liveId}
        shopId={live.product?.shop?.id}
        isHost={isHost}
        featured={featured}
        presentedProductId={presentedProductId}
        scrollY={catalogScrollY}
        seed={live.catalogProducts}
        onScroll={isHost ? setLocalScroll : undefined}
        onClose={() => {
          setBagOpen(false);
          setLocalPresented(null);
          setLocalScroll(0);
          if (isHost) void hostPost({ action: "catalog", open: false });
        }}
        onView={(product) => {
          if (isHost) {
            setLocalPresented(product.id);
            void hostPost({
              action: "catalog",
              open: true,
              presentedProductId: product.id,
            });
          }
        }}
        onClearView={() => {
          setLocalPresented(null);
          if (isHost) {
            void hostPost({
              action: "catalog",
              open: true,
              presentedProductId: null,
            });
          }
        }}
        onBuy={
          isHost
            ? undefined
            : (product) => {
                setBuyProduct(product);
              }
        }
      />
      <LiveGiftSheet
        open={giftOpen}
        busy={busy}
        onClose={() => setGiftOpen(false)}
        onSend={(amount) => void sendGift(amount)}
      />
      <LiveViewersSheet
        open={viewersOpen}
        onClose={() => setViewersOpen(false)}
        viewerCount={
          localViewerCount ?? live.viewerCount ?? live.viewerPeak ?? 0
        }
        qualifiedCount={localQualifiedCount || live.qualifiedViewerCount || 0}
        viewers={localViewers.length ? localViewers : (live.viewers ?? [])}
      />
      <Modal
        visible={layoutPickerOpen && isHost && !ended}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setLayoutPickerOpen(false)}
      >
        <View style={styles.layoutFrame}>
          <Pressable
            style={styles.layoutBackdrop}
            onPress={() => setLayoutPickerOpen(false)}
          />
          <View
            style={[
              styles.layoutSheet,
              { paddingBottom: Math.max(insets.bottom, 14) + 8 },
            ]}
          >
            <Text style={styles.layoutTitle}>Disposition scène</Text>
            <Text style={styles.layoutSub}>
              Placement des invités — visible pour tout le monde
            </Text>
            {LIVE_STAGE_LAYOUTS.map((row) => {
              const active = normalizeStageLayout(live.stageLayout) === row.id;
              return (
                <Pressable
                  key={row.id}
                  disabled={busy}
                  style={[styles.layoutRow, active && styles.layoutRowOn]}
                  onPress={() => {
                    void (async () => {
                      setBusy(true);
                      const ok = await hostPost({
                        action: "stage_layout",
                        layout: row.id,
                      });
                      setBusy(false);
                      if (ok) {
                        setLayoutPickerOpen(false);
                        showToast(`Disposition « ${row.label} »`, "success");
                        await liveQuery.refetch();
                      }
                    })();
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.layoutRowTitle}>
                      {row.label}
                      {active ? " · actif" : ""}
                    </Text>
                    <Text style={styles.layoutRowHint}>{row.hint}</Text>
                  </View>
                  {active ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#00D68F"
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
      <BuySheet
        product={buyProduct}
        onClose={() => setBuyProduct(null)}
        onAdded={() => {
          setBuyProduct(null);
          showToast("Ajouté au panier", "success");
        }}
      />
      </View>
    </>
  );

  if (sfu) {
    return (
      <LiveKitGate
        url={sfu.url}
        token={sfu.token}
        canPublish={canPublish}
        isHost={isHost}
        connect={!ended}
        paused={paused}
        cameraOn={live.cameraOn !== false}
        micOn={live.micOn !== false}
      >
        {room}
      </LiveKitGate>
    );
  }

  return room;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050508" },
  center: {
    flex: 1,
    backgroundColor: "#050508",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    zIndex: 20,
    elevation: 28,
  },
  guestQueue: {
    position: "absolute",
    left: 12,
    right: 72,
    zIndex: 46,
    elevation: 46,
  },
  shopName: {
    flex: 1,
    minWidth: 0,
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#333",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  livePill: {
    backgroundColor: colors.live,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  livePillText: { color: "#fff", fontWeight: "800", fontSize: 10 },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  stage: { ...StyleSheet.absoluteFill, backgroundColor: "#050508" },
  statusBox: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
    zIndex: 16,
  },
  statusTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  statusBody: {
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    lineHeight: 20,
  },
  endedTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  link: { color: "#00D68F", fontWeight: "700" },
  resumeWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  resume: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#00D68F",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  resumeText: { color: "#05140F", fontWeight: "800" },
  authBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 92,
    zIndex: 22,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 14,
    padding: 10,
  },
  authBannerText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 12,
  },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    gap: 8,
    zIndex: 20,
    elevation: 20,
    backgroundColor: "transparent",
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    paddingHorizontal: 8,
    minHeight: 48,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  input: { flex: 1, color: "#fff", fontSize: 15, paddingVertical: 10 },
  rail: {
    position: "absolute",
    right: 10,
    alignItems: "center",
    gap: 10,
    overflow: "visible",
    zIndex: 40,
    elevation: 40,
  },
  railBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  railBtnWait: {
    borderColor: "rgba(251,191,36,0.7)",
    backgroundColor: "rgba(251,191,36,0.18)",
  },
  railBtnOn: {
    borderColor: "#00D68F",
    backgroundColor: "rgba(0,214,143,0.22)",
  },
  railCount: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    marginTop: -2,
  },
  layoutFrame: { flex: 1, justifyContent: "flex-end" },
  layoutBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  layoutSheet: {
    backgroundColor: "#12121A",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  layoutTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  layoutSub: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  layoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  layoutRowOn: {
    borderColor: "rgba(0,214,143,0.55)",
    backgroundColor: "rgba(0,214,143,0.12)",
  },
  layoutRowTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  layoutRowHint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
});
