import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ToastHost } from "@/components/Toast";
import { api, mediaUrl } from "@/src/api";
import { parseCart } from "@/src/cart";
import { cartQueryKey } from "@/src/cart-store";
import { colorHex, isLightColor } from "@/src/color";
import { compactCount, formatMoney } from "@/src/format";
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
import { colors } from "@/src/theme";
import { showToast } from "@/src/toast";
import type { CommentItem, Product, ShopCard } from "@/src/types";

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
        <View style={styles.handle} />
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
          <View style={styles.handle} />
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
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
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

export function ShopProfileSheet({
  shop,
  onClose,
  onFollow,
}: {
  shop: ShopCard | null;
  onClose: () => void;
  onFollow: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={Boolean(shop)}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.frame}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(16, insets.bottom + 8) },
          ]}
        >
          <View style={styles.handle} />
          {shop?.logoUrl ? (
            <Image
              source={{ uri: mediaUrl(shop.logoUrl) ?? undefined }}
              style={styles.shopLogo}
            />
          ) : (
            <View style={styles.shopLogo} />
          )}
          <Text style={styles.title}>{shop?.name}</Text>
          <Text style={styles.shopMeta}>
            {compactCount(shop?.followersCount ?? 0)} abonnés · @{shop?.slug}
          </Text>
          <Pressable style={styles.send} onPress={onFollow}>
            <Text style={styles.sendText}>
              {shop?.followedByMe ? "Ne plus suivre" : "Suivre"}
            </Text>
          </Pressable>
          <Pressable onPress={onClose}>
            <Text style={styles.empty}>Fermer</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
