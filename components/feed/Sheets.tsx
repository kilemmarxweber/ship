import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ShopLiveAvatar } from "@/components/feed/ShopLiveAvatar";
import { ToastHost } from "@/components/Toast";
import { SheetReduce } from "@/components/ui/SheetReduce";
import { api, apiOrigin, mediaUrl } from "@/src/api";
import { parseCart } from "@/src/cart";
import { cartQueryKey } from "@/src/cart-store";
import { colorHex, isLightColor } from "@/src/color";
import { compactCount, formatMoney } from "@/src/format";
import { coverOf } from "@/src/media";
import { snapshotGet } from "@/src/offline/db";
import { commentsSnapKey } from "@/src/offline/keys";
import { persistComments } from "@/src/offline/persist";
import { requestOrQueue, saveCartLine } from "@/src/offline/writes";
import { useSession } from "@/src/session";
import {
    productInStock,
    productStock,
    stockAlertColor,
    stockFraction,
    stockLabel,
} from "@/src/stock";
import { HAIRLINE, colors } from "@/src/theme";
import { showToast } from "@/src/toast";
import type { CommentItem, Product, ShopCard } from "@/src/types";

function phoneDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

function shopPublicUrl(slug: string) {
  return `${apiOrigin()}/shop/${slug}`;
}

export function CommentsSheet({
  product,
  onClose,
  onPosted,
}: {
  product: Product | null;
  onClose: () => void;
  onPosted?: (productId: string) => void;
}) {
  return (
    <Modal
      visible={Boolean(product)}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {product ? (
        <CommentsBody
          key={product.id}
          product={product}
          onClose={onClose}
          onPosted={onPosted}
        />
      ) : null}
    </Modal>
  );
}

function CommentsBody({
  product,
  onClose,
  onPosted,
}: {
  product: Product;
  onClose: () => void;
  onPosted?: (productId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<CommentItem[]>(
    () => snapshotGet<CommentItem[]>(commentsSnapKey(product.id)) ?? [],
  );
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [keyboard, setKeyboard] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) => setKeyboard(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboard(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    const cached = snapshotGet<CommentItem[]>(commentsSnapKey(product.id));
    void api<{ comments: CommentItem[] }>(
      `/api/products/${product.id}/comments`,
    )
      .then((data) => {
        if (cancel) return;
        const next = data.comments ?? [];
        setItems(next);
        persistComments(product.id, next);
      })
      .catch((cause: unknown) => {
        if (cancel || (cached && cached.length > 0)) return;
        setError(
          cause instanceof Error ? cause.message : "Commentaires indisponibles",
        );
      });
    return () => {
      cancel = true;
    };
  }, [product.id]);

  async function send() {
    if (!product || !body.trim()) return;
    const text = body.trim();
    setBody("");
    const optimistic: CommentItem = {
      id: `temp:${Date.now()}`,
      body: text,
      createdAt: new Date().toISOString(),
      user: { id: "me", name: "Moi", image: null },
    };
    setItems((current) => {
      const next = [...current, optimistic];
      persistComments(product.id, next);
      return next;
    });
    try {
      const result = await requestOrQueue<{ comment: CommentItem }>({
        kind: "comment",
        path: `/api/products/${product.id}/comments`,
        method: "POST",
        body: { body: text },
      });
      if (!result.queued && result.data.comment) {
        setItems((current) => {
          const next = current.map((row) =>
            row.id === optimistic.id ? result.data.comment : row,
          );
          persistComments(product.id, next);
          return next;
        });
      }
      onPosted?.(product.id);
    } catch (cause) {
      setItems((current) => current.filter((row) => row.id !== optimistic.id));
      setError(cause instanceof Error ? cause.message : "Envoi impossible");
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.frame}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            marginBottom: Platform.OS === "android" ? keyboard : 0,
            paddingBottom: Math.max(16, insets.bottom + 8),
          },
        ]}
      >
        <SheetReduce onPress={onClose} />
        <Text style={styles.title}>Commentaires</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 280 }}
          renderItem={({ item }) => (
            <Text style={styles.line}>
              <Text style={styles.name}>{item.user.name} </Text>
              {item.body}
            </Text>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>Aucun commentaire</Text>
          }
        />
        <View style={styles.row}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Écrire un commentaire"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.input}
          />
          <Pressable onPress={() => void send()} style={styles.send}>
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

export function BuySheet({
  product,
  onClose,
  onAdded,
}: {
  product: Product | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const token = useSession((state) => state.token);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [stock, setStock] = useState(0);
  const [soldCount, setSoldCount] = useState(0);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setSize(product?.sizes[0] ?? null);
    setColor(product?.colors[0] ?? null);
    const available = product ? productStock(product) : 0;
    setStock(available);
    setSoldCount(product?.soldCount ?? 0);
    setQty(available > 0 ? 1 : 0);
    if (!product) return;
    void api<{
      product?: { quantity?: number; status?: string; soldCount?: number };
    }>(`/api/products/${product.id}`)
      .then((data) => {
        if (!data.product) return;
        const next = productStock(data.product);
        setStock(next);
        setSoldCount(data.product.soldCount ?? 0);
        setQty((current) => {
          if (next <= 0) return 0;
          return Math.min(Math.max(1, current), next);
        });
      })
      .catch(() => undefined);
  }, [product]);

  async function add() {
    if (!product) return;
    if (!productInStock({ ...product, quantity: stock }) || qty < 1) {
      showToast("Produit en rupture de stock", "error");
      return;
    }
    setPending(true);
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
        return;
      }
      await saveCartLine(queryClient, token, {
        productId: product.id,
        quantity: addQty,
        increment: true,
        product,
      });
      onAdded();
      showToast("Ajouté au sac", "success");
      setTimeout(onClose, 700);
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Ajout impossible",
        "error",
      );
    } finally {
      setPending(false);
    }
  }

  const cover = mediaUrl(
    product?.images.find((url) => !/\.(mp4|webm|mov)/i.test(url)) ??
      product?.images[0],
  );

  return (
    <Modal
      visible={Boolean(product)}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.buyFrame}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <ToastHost />
        <View
          style={[
            styles.buySheet,
            { paddingBottom: Math.max(18, insets.bottom + 10) },
          ]}
        >
          <SheetReduce onPress={onClose} />
          <View style={styles.buyHead}>
            {cover ? (
              <Image
                source={{ uri: cover }}
                style={styles.buyCover}
                contentFit="cover"
              />
            ) : (
              <View style={styles.buyCover} />
            )}
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.buyShop} numberOfLines={1}>
                {product?.shop.name}
              </Text>
              <Text style={styles.buyTitle} numberOfLines={2}>
                {product?.title}
              </Text>
              <Text
                style={[
                  styles.stockLine,
                  {
                    color: product
                      ? stockAlertColor({
                          quantity: stock,
                          soldCount,
                          status: product.status,
                        })
                      : colors.muted,
                  },
                  stock <= 0 && styles.stockGone,
                ]}
              >
                {product
                  ? `stock ${stockFraction({ quantity: stock, soldCount, status: product.status })} · ${stockLabel(stock)}`
                  : stockLabel(stock)}
              </Text>
              <View style={styles.priceRow}>
                <Text style={styles.buyPrice}>
                  {product
                    ? formatMoney(product.priceCents, product.currency)
                    : ""}
                </Text>
                {product?.compareAtCents &&
                product.compareAtCents > product.priceCents ? (
                  <Text style={styles.compare}>
                    {formatMoney(product.compareAtCents, product.currency)}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {product?.colors.length ? (
            <View style={styles.optionBlock}>
              <Text style={styles.optionLabel}>Couleur</Text>
              <View style={styles.swatches}>
                {product.colors.map((item) => {
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
                        selected && styles.swatchWrapOn,
                      ]}
                    >
                      <View
                        style={[
                          styles.swatch,
                          {
                            backgroundColor: fill,
                            borderColor: isLightColor(item)
                              ? "rgba(0,0,0,0.18)"
                              : "transparent",
                          },
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {product?.sizes.length ? (
            <View style={styles.optionBlock}>
              <Text style={styles.optionLabel}>Taille</Text>
              <View style={styles.chips}>
                {product.sizes.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => setSize(item)}
                    style={[styles.chip, size === item && styles.chipOn]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        size === item && styles.chipTextOn,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {stock > 0 ? (
            <View style={styles.qtyPick}>
              <Text style={styles.optionLabel}>Quantité</Text>
              <View style={styles.qtyRow}>
                <Pressable
                  disabled={pending || qty <= 1}
                  onPress={() => setQty((value) => Math.max(1, value - 1))}
                  style={styles.qtyBtn}
                >
                  <Ionicons name="remove" size={16} color="#fff" />
                </Pressable>
                <Text style={styles.qtyValue}>{qty}</Text>
                <Pressable
                  disabled={pending || qty >= stock}
                  onPress={() => setQty((value) => Math.min(stock, value + 1))}
                  style={styles.qtyBtn}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                </Pressable>
                <Text style={styles.qtyHint}>max {stock}</Text>
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={() => void add()}
            disabled={pending || stock <= 0}
            style={({ pressed }) => [
              styles.ctaWrap,
              pressed && { transform: [{ scale: 0.98 }] },
              (pending || stock <= 0) && { opacity: 0.7 },
            ]}
          >
            <LinearGradient
              colors={
                stock <= 0
                  ? ["#8d8d98", "#6b6b76"]
                  : [colors.buyStart, colors.buyEnd]
              }
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.cta}
            >
              {pending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="bag-handle" size={18} color="#fff" />
                  <Text style={styles.ctaText}>
                    {stock <= 0 ? "Rupture de stock" : "Ajouter au sac"}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.22)",
    marginBottom: 4,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    gap: 10,
  },
  title: { fontSize: 22, fontWeight: "800", color: "#fff" },
  line: { color: "rgba(255,255,255,0.88)", paddingVertical: 6 },
  name: { fontWeight: "700", color: "#fff" },
  empty: { color: colors.muted, paddingVertical: 12 },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 16,
  },
  send: {
    backgroundColor: colors.emerald,
    borderRadius: 12,
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  sendText: { color: "#04281c", fontWeight: "800" },
  error: { color: "#ff8a8a" },
  ok: { color: colors.emerald, fontWeight: "700" },
  cover: { width: 72, height: 72, borderRadius: 12 },
  price: { fontSize: 18, fontWeight: "800", color: colors.emerald },
  buyFrame: { flex: 1, justifyContent: "flex-end" },
  buySheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 18,
  },
  buyHead: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  buyCover: {
    width: 88,
    height: 110,
    borderRadius: 16,
    backgroundColor: "#222",
  },
  buyShop: {
    color: colors.emerald,
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  buyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 24,
  },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  buyPrice: { fontSize: 20, fontWeight: "800", color: "#fff" },
  compare: {
    color: colors.muted,
    textDecorationLine: "line-through",
    fontWeight: "600",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  optionBlock: { gap: 10 },
  optionLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  stockLine: {
    color: colors.emerald,
    fontWeight: "700",
    fontSize: 12,
  },
  stockGone: { color: "#ff8a8a" },
  qtyPick: { gap: 8 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyValue: {
    minWidth: 28,
    textAlign: "center",
    fontWeight: "800",
    fontSize: 18,
    color: "#fff",
  },
  qtyHint: { color: colors.muted, fontWeight: "600", fontSize: 12 },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatchWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchWrapOn: { borderColor: colors.buyStart },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minWidth: 44,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  chipOn: {
    backgroundColor: colors.buyStart,
    borderColor: colors.buyStart,
  },
  chipText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  chipTextOn: { color: "#fff" },
  ctaWrap: { marginTop: 4 },
  cta: {
    minHeight: 54,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
    flexShrink: 0,
  },
  shopLogo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#222",
  },
  shopMeta: { color: colors.muted, fontSize: 14 },
});

type ShopDetail = {
  contactPhone: string | null;
  contactName: string | null;
  description: string | null;
  productsCount: number;
  addressHint?: string | null;
  followersCount: number;
  followedByMe: boolean;
  lat?: number | null;
  lng?: number | null;
  alwaysOpen?: boolean | null;
  hoursStart?: string | null;
  hoursEnd?: string | null;
  workDays?: unknown;
  categories?: { id: string; count: number }[];
};

const PRODUCT_PREVIEW = 6;
const DISMISS_PULL = 36;

const shopStyles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "92%",
    overflow: "hidden",
  },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 10,
    alignItems: "center",
    gap: 12,
  },
  avatarWrap: { marginTop: 2, marginBottom: 2 },
  name: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
  },
  desc: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  hours: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    marginTop: 4,
  },
  socialBtn: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  wa: { backgroundColor: "#25D366" },
  tt: { backgroundColor: "#111111", borderWidth: 1, borderColor: HAIRLINE },
  fb: { backgroundColor: "#1877F2" },
  linkCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 14,
  },
  linkText: {
    flex: 1,
    color: colors.emerald,
    fontSize: 13,
    fontWeight: "700",
  },
  tools: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  toolChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
  },
  toolText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  toolMuted: { color: colors.muted, fontWeight: "600", fontSize: 13 },
  addressBox: {
    width: "100%",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
    gap: 4,
  },
  addressTitle: { color: "#fff", fontWeight: "700", fontSize: 13 },
  addressMeta: { color: colors.muted, fontSize: 11 },
  addressLink: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  section: { width: "100%", gap: 10, marginTop: 4 },
  productsHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  productsTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  productsCount: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  productCard: {
    width: "31.5%",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.card,
  },
  productCover: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#1a1a22",
  },
  productTitle: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 6,
    paddingTop: 6,
  },
  productPrice: {
    color: colors.emerald,
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 6,
    paddingBottom: 8,
    paddingTop: 2,
  },
  emptyProducts: {
    color: colors.muted,
    fontSize: 13,
    paddingVertical: 8,
    textAlign: "center",
  },
  seeMore: {
    alignSelf: "center",
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
    alignItems: "center",
    justifyContent: "center",
  },
  seeMoreText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  footer: {
    width: "100%",
    marginTop: 10,
    paddingBottom: 4,
  },
  follow: {
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
  },
  followOff: {
    backgroundColor: colors.live,
  },
  followText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
    textAlign: "center",
  },
  cats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
  },
  catChip: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  catText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
});

export function ShopProfileSheet({
  shop,
  live = false,
  onClose,
  onFollow,
}: {
  shop: ShopCard | null;
  live?: boolean;
  onClose: () => void;
  onFollow: () => void;
}) {
  return (
    <Modal
      visible={Boolean(shop)}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {shop ? (
        <ShopProfileBody
          key={shop.id}
          shop={shop}
          live={live}
          onClose={onClose}
          onFollow={onFollow}
        />
      ) : null}
    </Modal>
  );
}

function hoursLabel(detail: ShopDetail | null) {
  if (!detail) return null;
  if (detail.alwaysOpen) return "Toujours disponible";
  const start = detail.hoursStart?.trim();
  const end = detail.hoursEnd?.trim();
  if (start && end) return `Ouvert ${start} – ${end}`;
  return null;
}

function ShopProfileBody({
  shop,
  live,
  onClose,
  onFollow,
}: {
  shop: ShopCard;
  live: boolean;
  onClose: () => void;
  onFollow: () => void;
}) {
  const insets = useSafeAreaInsets();
  const token = useSession((state) => state.token);
  const [detail, setDetail] = useState<ShopDetail | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const pulling = useRef(false);
  const shopUrl = useMemo(() => shopPublicUrl(shop.slug), [shop.slug]);
  const phone = detail?.contactPhone?.trim() || null;
  const followed = shop.followedByMe;

  function openShopPage() {
    onClose();
    router.push(`/shop/${encodeURIComponent(shop.slug)}#produits` as Href);
  }

  function onSheetScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = event.nativeEvent.contentOffset.y;
    if (y < -DISMISS_PULL && pulling.current) {
      pulling.current = false;
      onClose();
    }
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setShowAllProducts(false);
    void (async () => {
      try {
        const [shopRes, productsRes] = await Promise.all([
          api<{ shop: ShopDetail & ShopCard & { lat?: number; lng?: number } }>(
            `/api/shops/${shop.slug}`,
          ),
          api<{ products: Product[] }>(
            `/api/products?shopId=${encodeURIComponent(shop.id)}&limit=48`,
          ),
        ]);
        if (!alive) return;
        const s = shopRes.shop;
        setDetail({
          contactPhone: s.contactPhone ?? null,
          contactName: s.contactName ?? null,
          description: s.description ?? null,
          productsCount: s.productsCount ?? 0,
          addressHint: s.addressHint ?? null,
          followersCount: s.followersCount ?? shop.followersCount ?? 0,
          followedByMe: s.followedByMe ?? shop.followedByMe ?? false,
          lat: s.lat ?? null,
          lng: s.lng ?? null,
          alwaysOpen: s.alwaysOpen ?? null,
          hoursStart: s.hoursStart ?? null,
          hoursEnd: s.hoursEnd ?? null,
          workDays: s.workDays,
          categories: s.categories ?? [],
        });
        setProducts(productsRes.products ?? []);
      } catch {
        if (!alive) return;
        showToast("Impossible de charger la boutique.", "error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [shop.id, shop.slug, shop.followersCount, shop.followedByMe]);

  async function openUrl(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      showToast("Application introuvable sur cet appareil.", "error");
    }
  }

  async function openWhatsApp() {
    const message = `Bonjour, je vous contacte depuis ShipShop à propos de ${shop.name}.\n${shopUrl}`;
    if (phone) {
      const digits = phoneDigits(phone);
      await openUrl(
        `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
      );
      return;
    }
    await openUrl(`https://wa.me/?text=${encodeURIComponent(message)}`);
  }

  async function openTikTok() {
    const text = `Découvre ${shop.name} sur ShipShop\n${shopUrl}`;
    try {
      await Share.share({ message: text, url: shopUrl });
    } catch {
      showToast("Partage impossible pour le moment.", "error");
    }
  }

  async function openFacebook() {
    const messenger = `https://www.facebook.com/dialog/send?link=${encodeURIComponent(shopUrl)}&app_id=966242223397117&redirect_uri=${encodeURIComponent(shopUrl)}`;
    try {
      await openUrl(messenger);
    } catch {
      await openUrl(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shopUrl)}`,
      );
    }
  }

  async function shareShop() {
    try {
      await Share.share({
        message: `Découvre ${shop.name} sur ShipShop\n${shopUrl}`,
        url: shopUrl,
      });
    } catch {
      showToast("Partage impossible pour le moment.", "error");
    }
  }

  async function messageSeller() {
    if (!token) {
      showToast("Connectez-vous pour écrire au vendeur.", "info");
      return;
    }
    try {
      const data = await api<{ conversation?: { id: string } }>(
        "/api/conversations",
        {
          method: "POST",
          body: JSON.stringify({
            shopId: shop.id,
            message: `Bonjour, je suis intéressé(e) par ${shop.name}.`,
          }),
        },
      );
      if (!data.conversation?.id) throw new Error("Conversation introuvable");
      onClose();
      router.push({
        pathname: "/(tabs)/messages/[id]",
        params: { id: data.conversation.id },
      });
    } catch {
      showToast("Impossible d'ouvrir la conversation.", "error");
    }
  }

  function openProduct(productId: string) {
    onClose();
    router.push({ pathname: "/product/[id]", params: { id: productId } });
  }

  const followers = detail?.followersCount ?? shop.followersCount ?? 0;
  const productsCount = detail?.productsCount ?? products.length;
  const visibleProducts = showAllProducts
    ? products
    : products.slice(0, PRODUCT_PREVIEW);
  const hours = hoursLabel(detail);
  const mapsUrl =
    detail?.lat != null && detail?.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${detail.lat},${detail.lng}`
      : null;

  return (
    <View style={styles.frame}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          shopStyles.sheet,
          { paddingBottom: Math.max(12, insets.bottom + 6) },
        ]}
      >
        <SheetReduce onPress={onClose} />

        <ScrollView
          contentContainerStyle={shopStyles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces
          alwaysBounceVertical
          onScrollBeginDrag={() => {
            pulling.current = true;
          }}
          onScrollEndDrag={(event) => {
            onSheetScroll(event);
            pulling.current = false;
          }}
          onMomentumScrollEnd={(event) => {
            onSheetScroll(event);
          }}
          onScroll={onSheetScroll}
          scrollEventThrottle={16}
        >
          <View style={shopStyles.avatarWrap}>
            <ShopLiveAvatar
              live={live}
              logoUrl={shop.logoUrl}
              name={shop.name}
              size={88}
              onPress={openShopPage}
            />
          </View>

          <Pressable onPress={openShopPage}>
            <Text style={shopStyles.name} numberOfLines={2}>
              {shop.name}
            </Text>
          </Pressable>
          <Text style={shopStyles.meta}>
            @{shop.slug} · {compactCount(followers)} abonnés
            {productsCount > 0
              ? ` · ${compactCount(productsCount)} produits`
              : ""}
          </Text>

          {detail?.description ? (
            <Text style={shopStyles.desc}>{detail.description}</Text>
          ) : null}
          {hours ? <Text style={shopStyles.hours}>{hours}</Text> : null}

          {(detail?.categories?.length ?? 0) > 0 ? (
            <View style={shopStyles.cats}>
              {(detail?.categories ?? []).slice(0, 6).map((cat) => (
                <View key={cat.id} style={shopStyles.catChip}>
                  <Text style={shopStyles.catText}>
                    {cat.id} · {cat.count}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={shopStyles.socialRow}>
            <Pressable
              style={[shopStyles.socialBtn, shopStyles.wa]}
              onPress={() => void openWhatsApp()}
              accessibilityLabel="WhatsApp"
            >
              <Ionicons name="logo-whatsapp" size={26} color="#fff" />
            </Pressable>
            <Pressable
              style={[shopStyles.socialBtn, shopStyles.tt]}
              onPress={() => void openTikTok()}
              accessibilityLabel="TikTok"
            >
              <Ionicons name="logo-tiktok" size={24} color="#fff" />
            </Pressable>
            <Pressable
              style={[shopStyles.socialBtn, shopStyles.fb]}
              onPress={() => void openFacebook()}
              accessibilityLabel="Facebook"
            >
              <Ionicons name="logo-facebook" size={26} color="#fff" />
            </Pressable>
          </View>

          <Pressable
            style={shopStyles.linkCard}
            onPress={() => void shareShop()}
          >
            <Ionicons name="link-outline" size={18} color={colors.emerald} />
            <Text style={shopStyles.linkText} numberOfLines={1}>
              {shopUrl.replace(/^https?:\/\//, "")}
            </Text>
            <Ionicons name="share-outline" size={18} color="#fff" />
          </Pressable>

          <View style={shopStyles.tools}>
            {phone ? (
              <Pressable
                style={shopStyles.toolChip}
                onPress={() => void openUrl(`tel:${phone}`)}
              >
                <Ionicons name="call" size={16} color={colors.emerald} />
                <Text style={shopStyles.toolText}>{phone}</Text>
              </Pressable>
            ) : (
              <View style={shopStyles.toolChip}>
                <Ionicons name="call-outline" size={16} color={colors.muted} />
                <Text style={shopStyles.toolMuted}>Contact non publié</Text>
              </View>
            )}
            <Pressable
              style={shopStyles.toolChip}
              onPress={() => setShowAddress((v) => !v)}
            >
              <Ionicons name="location-outline" size={16} color="#fff" />
              <Text style={shopStyles.toolText}>Adresse</Text>
            </Pressable>
            <Pressable
              style={shopStyles.toolChip}
              onPress={() => void messageSeller()}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={16}
                color="#fff"
              />
              <Text style={shopStyles.toolText}>Message</Text>
            </Pressable>
          </View>

          {showAddress ? (
            <View style={shopStyles.addressBox}>
              <Text style={shopStyles.addressTitle}>
                {detail?.addressHint ?? "Kinshasa, RDC"}
              </Text>
              {detail?.lat != null && detail?.lng != null ? (
                <Text style={shopStyles.addressMeta}>
                  {detail.lat.toFixed(5)}, {detail.lng.toFixed(5)}
                </Text>
              ) : null}
              {mapsUrl ? (
                <Pressable onPress={() => void openUrl(mapsUrl)}>
                  <Text style={shopStyles.addressLink}>Ouvrir dans Maps</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={shopStyles.section}>
            <View style={shopStyles.productsHead}>
              <Text style={shopStyles.productsTitle}>Produits</Text>
              <Text style={shopStyles.productsCount}>
                {compactCount(productsCount)}
              </Text>
            </View>

            {loading ? (
              <ActivityIndicator color={colors.emerald} />
            ) : products.length === 0 ? (
              <Text style={shopStyles.emptyProducts}>
                Aucun produit pour le moment.
              </Text>
            ) : (
              <>
                <View style={shopStyles.grid}>
                  {visibleProducts.map((product) => {
                    const cover = coverOf(product.images ?? []);
                    return (
                      <Pressable
                        key={product.id}
                        style={shopStyles.productCard}
                        onPress={() => openProduct(product.id)}
                      >
                        <Image
                          source={{ uri: cover ?? undefined }}
                          style={shopStyles.productCover}
                        />
                        <Text style={shopStyles.productTitle} numberOfLines={2}>
                          {product.title}
                        </Text>
                        <Text style={shopStyles.productPrice}>
                          {formatMoney(product.priceCents, product.currency)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {products.length > PRODUCT_PREVIEW ? (
                  <Pressable
                    style={shopStyles.seeMore}
                    onPress={() => setShowAllProducts((v) => !v)}
                  >
                    <Text style={shopStyles.seeMoreText}>
                      {showAllProducts
                        ? "Voir moins"
                        : `Voir plus (${products.length - PRODUCT_PREVIEW})`}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>

          <View style={shopStyles.footer}>
            <Pressable
              style={[shopStyles.follow, followed && shopStyles.followOff]}
              onPress={onFollow}
            >
              <Text style={shopStyles.followText}>
                {followed ? "Ne plus suivre" : "Suivre"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
