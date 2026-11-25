import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    Share,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ToastHost } from "@/components/Toast";
import { api, apiOrigin, mediaUrl } from "@/src/api";
import { parseCart } from "@/src/cart";
import { cartQueryKey } from "@/src/cart-store";
import { colorHex, isLightColor } from "@/src/color";
import { compactCount, formatMoney } from "@/src/format";
import { saveCartLine } from "@/src/offline/writes";
import { usePrefs } from "@/src/prefs";
import { useSession } from "@/src/session";
import { productInStock, productStock, stockLabel } from "@/src/stock";
import { showToast } from "@/src/toast";
import type { Product } from "@/src/types";
import { useColors } from "@/src/use-colors";

type BuySheetProps = {
  product: Product | null;
  onClose: () => void;
  onAdded: () => void;
};

export function BuySheet(props: BuySheetProps) {
  return <BuySheetContent key={props.product?.id ?? "closed"} {...props} />;
}

function BuySheetContent({ product, onClose, onAdded }: BuySheetProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const c = useColors();
  const theme = usePrefs((state) => state.theme);
  const isDark = theme !== "light";
  const mutedSurface = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const queryClient = useQueryClient();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const galleryRef = useRef<FlatList<string>>(null);
  const zoomListRef = useRef<FlatList<string>>(null);

  const compact = windowHeight < 720;
  const panelRadius = compact ? 22 : 28;

  const gallery = useMemo(() => {
    if (!product) return [] as string[];
    const stills = product.images.filter(
      (url) => !/\.(mp4|webm|mov)/i.test(url),
    );
    const urls = (stills.length ? stills : product.images)
      .map((url) => mediaUrl(url) ?? url)
      .filter(Boolean);
    return urls.length ? urls : [""];
  }, [product]);

  const initialStock = product ? productStock(product) : 0;
  const [size, setSize] = useState<string | null>(product?.sizes[0] ?? null);
  const [color, setColor] = useState<string | null>(product?.colors[0] ?? null);
  const [qty, setQty] = useState(initialStock > 0 ? 1 : 0);
  const [stock, setStock] = useState(initialStock);
  const [soldCount, setSoldCount] = useState(product?.soldCount ?? 0);
  const [pending, setPending] = useState(false);
  const [buying, setBuying] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [liked, setLiked] = useState(Boolean(product?.likedByMe));
  const [likesCount, setLikesCount] = useState(product?.likesCount ?? 0);
  const [heroH, setHeroH] = useState(Math.round(windowHeight * 0.55));
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);

  useEffect(() => {
    if (!product) return;
    void api<{
      product?: {
        quantity?: number;
        status?: string;
        soldCount?: number;
        likedByMe?: boolean;
        likesCount?: number;
      };
    }>(`/api/products/${product.id}`)
      .then((data) => {
        if (!data.product) return;
        const next = productStock(data.product);
        setStock(next);
        setSoldCount(data.product.soldCount ?? 0);
        if (typeof data.product.likedByMe === "boolean") {
          setLiked(data.product.likedByMe);
        }
        if (typeof data.product.likesCount === "number") {
          setLikesCount(data.product.likesCount);
        }
        setQty((current) => {
          if (next <= 0) return 0;
          return Math.min(Math.max(1, current), next);
        });
      })
      .catch(() => undefined);
  }, [product]);

  async function addToBag(): Promise<boolean> {
    if (!product) return false;
    if (!token) {
      openAuth();
      return false;
    }
    if (!productInStock({ ...product, quantity: stock }) || qty < 1) {
      showToast("Produit en rupture de stock", "error");
      return false;
    }
    try {
      const cached = parseCart(
        queryClient.getQueryData(cartQueryKey(token)) ?? {},
      );
      const already =
        cached.items.find((item) => item.productId === product.id)?.quantity ??
        0;
      const room = Math.max(0, stock - already);
      const addQty = Math.min(qty, room);
      if (addQty < 1) {
        showToast(
          already > 0
            ? "Quantité max déjà dans le sac"
            : "Produit en rupture de stock",
          "error",
        );
        return false;
      }
      await saveCartLine(queryClient, token, {
        productId: product.id,
        quantity: addQty,
        increment: true,
        product,
      });
      onAdded();
      return true;
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Ajout impossible",
        "error",
      );
      return false;
    }
  }

  async function onAddToBag() {
    setPending(true);
    try {
      const ok = await addToBag();
      if (ok) {
        showToast("Ajouté au sac", "success");
        setTimeout(onClose, 700);
      }
    } finally {
      setPending(false);
    }
  }

  async function onBuyNow() {
    setBuying(true);
    try {
      const ok = await addToBag();
      if (ok) {
        onClose();
        router.push("/(tabs)/cart" as Href);
      }
    } finally {
      setBuying(false);
    }
  }

  async function toggleLike() {
    if (!product) return;
    if (!token) {
      openAuth();
      return;
    }
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikesCount((n) => Math.max(0, n + (wasLiked ? -1 : 1)));
    try {
      const data = await api<{ liked?: boolean; likesCount?: number }>(
        `/api/products/${product.id}/like`,
        { method: wasLiked ? "DELETE" : "POST" },
      );
      if (typeof data.liked === "boolean") setLiked(data.liked);
      if (typeof data.likesCount === "number") setLikesCount(data.likesCount);
    } catch {
      setLiked(wasLiked);
      setLikesCount(product.likesCount);
      showToast("Impossible de liker", "error");
    }
  }

  async function shareProduct() {
    if (!product) return;
    const link = `${apiOrigin()}/product/${product.id}`;
    await Share.share({ message: `${product.title}\n${link}` });
    try {
      await api(`/api/products/${product.id}/share`, { method: "POST" });
    } catch {
      /* local share still ok */
    }
  }

  function cycleImage() {
    if (gallery.length < 2) return;
    const next = (imageIndex + 1) % gallery.length;
    setImageIndex(next);
    galleryRef.current?.scrollToIndex({ index: next, animated: true });
  }

  function openZoom(at = imageIndex) {
    setZoomIndex(at);
    setZoomOpen(true);
    requestAnimationFrame(() => {
      zoomListRef.current?.scrollToIndex({ index: at, animated: false });
    });
  }

  function onGalleryScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / Math.max(1, windowWidth));
    if (next !== imageIndex && next >= 0 && next < gallery.length) {
      setImageIndex(next);
    }
  }

  function onZoomScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / Math.max(1, windowWidth));
    if (next !== zoomIndex && next >= 0 && next < gallery.length) {
      setZoomIndex(next);
      setImageIndex(next);
      galleryRef.current?.scrollToIndex({ index: next, animated: false });
    }
  }

  const ratingLabel = useMemo(() => {
    if (!product) return "";
    const reviews = Math.max(soldCount, likesCount, product.commentsCount ?? 0);
    const score =
      likesCount <= 0
        ? 4.5
        : Math.min(5, 3.9 + Math.min(likesCount, 180) / 180).toFixed(1);
    return `${score} (${compactCount(Math.max(1, reviews))} avis)`;
  }, [product, soldCount, likesCount]);

  const busy = pending || buying;
  const outOfStock = stock <= 0;
  const hasColors = Boolean(product?.colors?.length);
  const hasSizes = Boolean(product?.sizes?.length);

  return (
    <Modal
      visible={Boolean(product)}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: c.background }]}>
        <ToastHost />

        <View
          style={styles.hero}
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            if (h > 0 && h !== heroH) setHeroH(h);
          }}
        >
          <FlatList
            ref={galleryRef}
            data={gallery}
            keyExtractor={(uri, i) => `${uri}-${i}`}
            horizontal
            pagingEnabled
            style={StyleSheet.absoluteFill}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onGalleryScroll}
            getItemLayout={(_, index) => ({
              length: windowWidth,
              offset: windowWidth * index,
              index,
            })}
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => openZoom(index)}
                accessibilityLabel="Agrandir l'image"
                style={{ width: windowWidth, height: heroH }}
              >
                {item ? (
                  <Image
                    source={{ uri: item }}
                    style={{ width: windowWidth, height: heroH }}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: windowWidth,
                      height: heroH,
                      backgroundColor: c.card,
                    }}
                  />
                )}
              </Pressable>
            )}
          />

          <View
            pointerEvents="box-none"
            style={[
              styles.heroChrome,
              { paddingTop: insets.top + 6, paddingHorizontal: 14 },
            ]}
          >
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityLabel="Retour"
              style={styles.backHit}
            >
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </Pressable>

            <View style={styles.heroActions}>
              <ChromeIcon
                icon="expand-outline"
                label="Zoom"
                onPress={() => openZoom(imageIndex)}
              />
              <ChromeIcon
                icon="sync-outline"
                label="Image suivante"
                onPress={cycleImage}
              />
              <ChromeIcon
                icon={liked ? "heart" : "heart-outline"}
                label="Favori"
                color={liked ? c.buyStart : "#fff"}
                onPress={() => void toggleLike()}
              />
              <ChromeIcon
                icon="share-outline"
                label="Partager"
                onPress={() => void shareProduct()}
              />
            </View>
          </View>

          <View style={styles.pagerWrap} pointerEvents="none">
            <View style={styles.segments}>
              {gallery.map((_, i) => (
                <View
                  key={`seg-${i}`}
                  style={[
                    styles.segment,
                    i === imageIndex ? styles.segmentOn : styles.segmentOff,
                    { flex: 1 },
                  ]}
                />
              ))}
            </View>
            <View style={styles.pagerPill}>
              <Text style={styles.pagerText}>
                {imageIndex + 1}/{gallery.length}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.panel,
            compact && styles.panelCompact,
            {
              backgroundColor: c.sheet,
              borderTopLeftRadius: panelRadius,
              borderTopRightRadius: panelRadius,
              marginTop: -panelRadius,
              paddingBottom: Math.max(8, insets.bottom + 4),
            },
          ]}
        >
          <Text
            style={[styles.title, compact && styles.titleSm, { color: c.text }]}
            numberOfLines={1}
          >
            {product?.title ?? ""}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color="#F5C518" />
              <Text style={[styles.ratingText, { color: c.textMuted }]}>
                {ratingLabel}
              </Text>
            </View>
            <Text
              style={[
                styles.price,
                compact && styles.priceSm,
                { color: c.emerald },
              ]}
            >
              {product ? formatMoney(product.priceCents, product.currency) : ""}
            </Text>
          </View>

          {product?.compareAtCents &&
          product.compareAtCents > product.priceCents ? (
            <Text style={[styles.compare, { color: c.textMuted }]}>
              {formatMoney(product.compareAtCents, product.currency)}
            </Text>
          ) : null}

          {hasColors || hasSizes ? (
            <View style={styles.optionsRow}>
              {hasColors ? (
                <View
                  style={[styles.optionCol, hasSizes && styles.optionColHalf]}
                >
                  <Text style={[styles.optionLabel, { color: c.textMuted }]}>
                    Couleur
                  </Text>
                  <View style={styles.swatches}>
                    {product!.colors.map((item) => {
                      const selected = color === item;
                      const fill = colorHex(item);
                      return (
                        <Pressable
                          key={item}
                          onPress={() => setColor(item)}
                          accessibilityLabel={item}
                          accessibilityRole="button"
                          style={[
                            styles.swatchWrap,
                            selected && {
                              borderColor: isDark ? "#FFFFFF" : c.ink,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.swatch,
                              {
                                backgroundColor: fill,
                                borderColor: isLightColor(item)
                                  ? "rgba(0,0,0,0.18)"
                                  : "rgba(255,255,255,0.22)",
                              },
                            ]}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {hasSizes ? (
                <View
                  style={[styles.optionCol, hasColors && styles.optionColHalf]}
                >
                  <Text style={[styles.optionLabel, { color: c.textMuted }]}>
                    Taille
                  </Text>
                  <View style={styles.chips}>
                    {product!.sizes.map((item) => {
                      const on = size === item;
                      return (
                        <Pressable
                          key={item}
                          onPress={() => setSize(item)}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: on ? c.emerald : mutedSurface,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: on ? "#FFFFFF" : c.text },
                            ]}
                          >
                            {item}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {outOfStock ? (
            <Text style={[styles.stockHint, { color: "#ff8a8a" }]}>
              {stockLabel(0)}
            </Text>
          ) : null}

          <View style={styles.ctaStack}>
            <Pressable
              onPress={() => void onAddToBag()}
              disabled={busy || outOfStock}
              style={({ pressed }) => [
                styles.ctaPrimaryWrap,
                pressed && { opacity: 0.88 },
                (busy || outOfStock) && { opacity: 0.55 },
              ]}
              accessibilityLabel="Ajouter au sac"
            >
              <View style={[styles.ctaPrimary, { backgroundColor: c.emerald }]}>
                {pending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="bag-handle" size={16} color="#FFFFFF" />
                    <Text style={styles.ctaPrimaryText}>
                      {outOfStock ? "Rupture de stock" : "Ajouter au sac"}
                    </Text>
                  </>
                )}
              </View>
            </Pressable>

            <Pressable
              onPress={() => void onBuyNow()}
              disabled={busy || outOfStock}
              style={({ pressed }) => [
                styles.ctaSecondary,
                { backgroundColor: mutedSurface },
                pressed && { opacity: 0.88 },
                (busy || outOfStock) && { opacity: 0.55 },
              ]}
              accessibilityLabel="Acheter maintenant"
            >
              {buying ? (
                <ActivityIndicator color={c.emerald} size="small" />
              ) : (
                <>
                  <LinearGradient
                    colors={[c.buyStart, c.buyEnd]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.boltBadge}
                  >
                    <Ionicons name="flash" size={12} color="#fff" />
                  </LinearGradient>
                  <Text style={[styles.ctaSecondaryText, { color: c.text }]}>
                    Acheter maintenant
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      <Modal
        visible={zoomOpen}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => setZoomOpen(false)}
      >
        <View style={[styles.zoomRoot, { paddingTop: insets.top }]}>
          <View style={styles.zoomBar}>
            <Pressable
              onPress={() => setZoomOpen(false)}
              hitSlop={10}
              accessibilityLabel="Fermer le zoom"
              style={styles.zoomClose}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.zoomCount}>
              {zoomIndex + 1}/{gallery.length}
            </Text>
            <Text style={styles.zoomHint}>Pince ou double-tap</Text>
          </View>

          <FlatList
            ref={zoomListRef}
            data={gallery}
            keyExtractor={(uri, i) => `zoom-${uri}-${i}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onZoomScroll}
            getItemLayout={(_, index) => ({
              length: windowWidth,
              offset: windowWidth * index,
              index,
            })}
            renderItem={({ item }) => (
              <View style={{ width: windowWidth, height: windowHeight - 80 }}>
                {item ? (
                  <ZoomableImage uri={item} width={windowWidth} />
                ) : (
                  <View style={{ flex: 1, backgroundColor: "#111" }} />
                )}
              </View>
            )}
          />
        </View>
      </Modal>
    </Modal>
  );
}

function ZoomableImage({ uri, width }: { uri: string; width: number }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(4, Math.max(1, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1.05) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.2) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedTx.value = 0;
        savedTy.value = 0;
      } else {
        scale.value = withTiming(2.4);
        savedScale.value = 2.4;
      }
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ flex: 1, width }, animStyle]}>
        <Image
          source={{ uri }}
          style={{ width, flex: 1 }}
          contentFit="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
}

function ChromeIcon({
  icon,
  label,
  onPress,
  color = "#fff",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.chromeBtn, pressed && { opacity: 0.75 }]}
    >
      <Ionicons name={icon} size={16} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  hero: {
    flex: 1,
    width: "100%",
    minHeight: 200,
    backgroundColor: "#0E0E14",
    overflow: "hidden",
  },
  heroChrome: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  backHit: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chromeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  pagerWrap: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 36,
    alignItems: "center",
    gap: 6,
  },
  segments: {
    flexDirection: "row",
    width: "100%",
    gap: 3,
    alignItems: "center",
  },
  segment: { height: 2.5, borderRadius: 2 },
  segmentOn: { backgroundColor: "#fff", height: 3.5 },
  segmentOff: { backgroundColor: "rgba(255,255,255,0.35)" },
  pagerPill: {
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pagerText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  panel: {
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 18,
    paddingTop: 14,
    gap: 8,
    borderCurve: "continuous",
    zIndex: 2,
  },
  panelCompact: {
    paddingTop: 10,
    gap: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  titleSm: { fontSize: 17, lineHeight: 20 },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  ratingText: { fontSize: 11, fontWeight: "500" },
  price: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  priceSm: { fontSize: 17 },
  compare: {
    fontSize: 12,
    fontWeight: "600",
    textDecorationLine: "line-through",
    marginTop: -4,
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginTop: 2,
  },
  optionCol: { gap: 6, flexShrink: 1 },
  optionColHalf: { flex: 1 },
  optionLabel: { fontSize: 11, fontWeight: "500" },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  swatchWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    minWidth: 36,
    minHeight: 32,
    borderRadius: 10,
    borderCurve: "continuous",
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontWeight: "700", fontSize: 12 },
  stockHint: { fontSize: 11, fontWeight: "600" },
  ctaStack: { gap: 6, paddingTop: 4 },
  ctaPrimaryWrap: { borderRadius: 999, overflow: "hidden" },
  ctaPrimary: {
    minHeight: 40,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  ctaPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  ctaSecondary: {
    minHeight: 40,
    borderRadius: 999,
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  ctaSecondaryText: { fontWeight: "700", fontSize: 13 },
  boltBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomRoot: {
    flex: 1,
    backgroundColor: "#000",
  },
  zoomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  zoomClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomCount: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  zoomHint: {
    marginLeft: "auto",
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "500",
  },
});
