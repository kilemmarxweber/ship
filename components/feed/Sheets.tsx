import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ToastHost } from "@/components/Toast";
import { ShopLiveAvatar } from "@/components/feed/ShopLiveAvatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SheetReduce } from "@/components/ui/SheetReduce";
import { api, apiOrigin, mediaUrl } from "@/src/api";
import { parseCart } from "@/src/cart";
import { cartQueryKey } from "@/src/cart-store";
import { colorHex, isLightColor } from "@/src/color";
import { compactCount, formatMoney } from "@/src/format";
import { useMe } from "@/src/me";
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
import { colors } from "@/src/theme";
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
  onDeleted,
}: {
  product: Product | null;
  onClose: () => void;
  onPosted?: (productId: string) => void;
  onDeleted?: (productId: string) => void;
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
          onDeleted={onDeleted}
        />
      ) : null}
    </Modal>
  );
}

function CommentsBody({
  product,
  onClose,
  onPosted,
  onDeleted,
}: {
  product: Product;
  onClose: () => void;
  onPosted?: (productId: string) => void;
  onDeleted?: (productId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const me = useMe();
  const [items, setItems] = useState<CommentItem[]>(
    () => snapshotGet<CommentItem[]>(commentsSnapKey(product.id)) ?? [],
  );
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [keyboard, setKeyboard] = useState(0);
  const [commentToDelete, setCommentToDelete] = useState<CommentItem | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const myId = me.data?.id;
  const roles = me.data?.roles ?? [];
  const isPlatformAdmin = roles.includes("ADMIN") || roles.includes("OWNER");
  function canDelete(comment: CommentItem) {
    if (comment.id.startsWith("temp:")) return false;
    return comment.user.id === myId || isPlatformAdmin;
  }

  async function removeComment(comment: CommentItem) {
    setDeleting(true);
    try {
      await api(`/api/products/${product.id}/comments/${comment.id}`, {
        method: "DELETE",
      });
      setItems((current) => {
        const next = current.filter((row) => row.id !== comment.id);
        persistComments(product.id, next);
        return next;
      });
      setCommentToDelete(null);
      onDeleted?.(product.id);
      showToast("Commentaire supprimé", "success");
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Suppression impossible",
        "error",
      );
    } finally {
      setDeleting(false);
    }
  }

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
            <View style={styles.commentRow}>
              <Text style={styles.line}>
                <Text style={styles.name}>{item.user.name} </Text>
                {item.body}
              </Text>
              {canDelete(item) ? (
                <Pressable
                  onPress={() => setCommentToDelete(item)}
                  hitSlop={8}
                  style={styles.commentDelete}
                  accessibilityLabel="Retirer le commentaire"
                >
                  <Ionicons
                    name="trash-outline"
                    size={14}
                    color="rgba(255,255,255,0.5)"
                  />
                </Pressable>
              ) : null}
            </View>
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
      <ConfirmDialog
        open={Boolean(commentToDelete)}
        title="Retirer ce commentaire ?"
        message="Cette action est définitive."
        busy={deleting}
        onCancel={() => setCommentToDelete(null)}
        onConfirm={() => {
          if (commentToDelete) void removeComment(commentToDelete);
        }}
      />
    </KeyboardAvoidingView>
  );
}

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
  const queryClient = useQueryClient();
  const token = useSession((state) => state.token);
  const initialStock = product ? productStock(product) : 0;
  const [size, setSize] = useState<string | null>(product?.sizes[0] ?? null);
  const [color, setColor] = useState<string | null>(product?.colors[0] ?? null);
  const [qty, setQty] = useState(initialStock > 0 ? 1 : 0);
  const [stock, setStock] = useState(initialStock);
  const [soldCount, setSoldCount] = useState(product?.soldCount ?? 0);
  const [pending, setPending] = useState(false);

  useEffect(() => {
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
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    gap: 10,
  },
  title: { fontSize: 22, fontWeight: "800", color: "#fff" },
  line: {
    flex: 1,
    color: "rgba(255,255,255,0.88)",
    paddingVertical: 6,
  },
  name: { fontWeight: "700", color: "#fff" },
  commentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  commentDelete: { padding: 4 },
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
});

type ShopProfileDetail = ShopCard & {
  contactPhone?: string | null;
  description?: string | null;
  productsCount?: number;
  addressHint?: string | null;
  followersCount?: number;
  followedByMe?: boolean;
  lat?: number | null;
  lng?: number | null;
  alwaysOpen?: boolean | null;
  hoursStart?: string | null;
  hoursEnd?: string | null;
  categories?: { id: string; count: number }[];
  tiktokUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  xUrl?: string | null;
};

const PRODUCT_PREVIEW = 6;

const shopProfileStyles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "90%",
    paddingTop: 8,
  },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 8,
    alignItems: "center",
    gap: 12,
  },
  shopIdentity: { alignItems: "center", gap: 8 },
  shopName: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  meta: { color: colors.muted, fontSize: 13, textAlign: "center" },
  desc: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  hours: { color: colors.muted, fontSize: 12, textAlign: "center" },
  cats: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  catChip: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  catText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
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
  tt: {
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  ig: { backgroundColor: "#E1306C" },
  fb: { backgroundColor: "#1877F2" },
  x: {
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  linkCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
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
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
  },
  toolText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  toolMuted: { color: colors.muted, fontWeight: "600", fontSize: 13 },
  addressBox: {
    width: "100%",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    gap: 4,
  },
  addressTitle: { color: "#fff", fontWeight: "800" },
  addressMeta: { color: colors.muted, fontSize: 11 },
  addressLink: { color: colors.emerald, fontWeight: "800", marginTop: 4 },
  section: { width: "100%", gap: 10, marginTop: 4 },
  productsHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  productsTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  productsCount: { color: colors.muted, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  productCard: {
    width: "48%",
    borderRadius: 14,
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  productCover: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: "#222",
  },
  currentProduct: { borderWidth: 1, borderColor: colors.buyEnd },
  productTag: {
    color: colors.buyEnd,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 5,
  },
  productTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
    marginTop: 4,
  },
  productPrice: {
    color: colors.emerald,
    fontWeight: "800",
    fontSize: 12,
    marginTop: 4,
  },
  emptyProducts: { color: colors.muted, fontSize: 13 },
  moreProducts: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  moreProductsText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  follow: {
    width: "100%",
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: colors.buyEnd,
    alignItems: "center",
    justifyContent: "center",
  },
  followOff: { backgroundColor: "#DC2626" },
  followText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
    flexShrink: 0,
  },
  error: { color: "#ff9c9c", fontSize: 12, textAlign: "center" },
});

export function ShopProfileSheet({
  shop,
  activeProduct,
  onClose,
  onFollow,
}: {
  shop: ShopCard | null;
  activeProduct?: Product | null;
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
          activeProduct={activeProduct}
          onClose={onClose}
          onFollow={onFollow}
        />
      ) : null}
    </Modal>
  );
}

function ShopProfileBody({
  shop,
  activeProduct,
  onClose,
  onFollow,
}: {
  shop: ShopCard;
  activeProduct?: Product | null;
  onClose: () => void;
  onFollow: () => void;
}) {
  const insets = useSafeAreaInsets();
  const token = useSession((state) => state.token);
  const [detail, setDetail] = useState<ShopProfileDetail | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const shopUrl = shopPublicUrl(shop.slug);
  const phone = detail?.contactPhone?.trim() || null;

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [shopRes, productsRes] = await Promise.all([
          api<{ shop: ShopProfileDetail }>(`/api/shops/${shop.slug}`),
          api<{ products: Product[] }>(
            `/api/products?shopId=${encodeURIComponent(shop.id)}&limit=48&status=ACTIVE`,
          ),
        ]);
        if (!active) return;
        setDetail(shopRes.shop);
        setProducts(productsRes.products ?? []);
      } catch (cause) {
        if (!active) return;
        const message =
          cause instanceof Error
            ? cause.message
            : "Impossible de charger la boutique.";
        setLoadError(message);
        showToast(message, "error");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [shop.id, shop.slug]);

  async function openUrl(url: string) {
    try {
      await Linking.openURL(url);
    } catch (cause) {
      showToast(
        cause instanceof Error
          ? cause.message
          : "Application introuvable sur cet appareil.",
        "error",
      );
    }
  }

  async function openWhatsApp() {
    if (!phone) {
      showToast("Aucun numéro WhatsApp pour cette boutique.", "info");
      return;
    }
    const message = `Bonjour, je vous contacte depuis ShipShop à propos de ${shop.name}.\n${shopUrl}`;
    const suffix = `?text=${encodeURIComponent(message)}`;
    await openUrl(`https://wa.me/${phoneDigits(phone)}${suffix}`);
  }

  async function openSocial(url: string | null | undefined, label: string) {
    const href = url?.trim();
    if (!href) {
      showToast(`Le vendeur n’a pas encore indiqué son ${label}.`, "info");
      return;
    }
    await openUrl(href);
  }

  async function shareShop() {
    try {
      await Share.share({
        message: `Découvre ${shop.name} sur ShipShop\n${shopUrl}`,
        url: shopUrl,
      });
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Partage impossible.",
        "error",
      );
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
      if (!data.conversation?.id) {
        throw new Error("Conversation introuvable.");
      }
      onClose();
      router.push({
        pathname: "/(tabs)/messages/[id]",
        params: { id: data.conversation.id },
      });
    } catch (cause) {
      showToast(
        cause instanceof Error
          ? cause.message
          : "Impossible d'ouvrir la conversation.",
        "error",
      );
    }
  }

  function openShop() {
    onClose();
    router.push(`/shop/${shop.slug}#produits` as Href);
  }

  function openProduct(productId: string) {
    onClose();
    router.push({ pathname: "/product/[id]", params: { id: productId } });
  }

  const visibleProducts = [
    ...(activeProduct?.shop.id === shop.id ? [activeProduct] : []),
    ...products.filter((product) => product.id !== activeProduct?.id),
  ];
  const displayedProducts = showAllProducts
    ? visibleProducts
    : visibleProducts.slice(0, PRODUCT_PREVIEW);
  const followers = shop.followersCount ?? detail?.followersCount ?? 0;
  const productCount = detail?.productsCount ?? visibleProducts.length;
  const hours = detail?.alwaysOpen
    ? "Toujours disponible"
    : detail?.hoursStart && detail?.hoursEnd
      ? `Ouvert ${detail.hoursStart} – ${detail.hoursEnd}`
      : null;
  const mapsUrl =
    detail?.lat != null && detail?.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${detail.lat},${detail.lng}`
      : null;
  const followed = Boolean(shop.followedByMe ?? detail?.followedByMe);
  const tiktokUrl = detail?.tiktokUrl?.trim() || null;
  const facebookUrl = detail?.facebookUrl?.trim() || null;
  const instagramUrl = detail?.instagramUrl?.trim() || null;
  const xUrl = detail?.xUrl?.trim() || null;
  const hasSocials = Boolean(
    phone || tiktokUrl || facebookUrl || instagramUrl || xUrl,
  );

  return (
    <View style={styles.frame}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          shopProfileStyles.sheet,
          { paddingBottom: Math.max(12, insets.bottom + 6) },
        ]}
      >
        <SheetReduce onPress={onClose} />
        <ScrollView
          contentContainerStyle={shopProfileStyles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={shopProfileStyles.shopIdentity}>
            <ShopLiveAvatar
              live={false}
              logoUrl={shop.logoUrl}
              name={shop.name}
              size={88}
              accentColor={colors.buyEnd}
              accessibilityLabel={`Voir les produits de ${shop.name}`}
              onPress={openShop}
            />
            <Text style={shopProfileStyles.shopName} numberOfLines={2}>
              {shop.name}
            </Text>
          </View>
          <Text style={shopProfileStyles.meta}>
            @{shop.slug} · {compactCount(followers)} abonnés
            {productCount > 0
              ? ` · ${compactCount(productCount)} produits`
              : ""}
          </Text>

          {detail?.description ? (
            <Text style={shopProfileStyles.desc}>{detail.description}</Text>
          ) : null}
          {hours ? <Text style={shopProfileStyles.hours}>{hours}</Text> : null}

          {(detail?.categories?.length ?? 0) > 0 ? (
            <View style={shopProfileStyles.cats}>
              {detail?.categories?.slice(0, 6).map((category) => (
                <View key={category.id} style={shopProfileStyles.catChip}>
                  <Text style={shopProfileStyles.catText}>
                    {category.id} · {category.count}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {hasSocials ? (
            <View style={shopProfileStyles.socialRow}>
              {phone ? (
                <Pressable
                  style={[shopProfileStyles.socialBtn, shopProfileStyles.wa]}
                  onPress={() => void openWhatsApp()}
                  accessibilityRole="button"
                  accessibilityLabel="Contacter sur WhatsApp"
                >
                  <Ionicons name="logo-whatsapp" size={26} color="#fff" />
                </Pressable>
              ) : null}
              {tiktokUrl ? (
                <Pressable
                  style={[shopProfileStyles.socialBtn, shopProfileStyles.tt]}
                  onPress={() => void openSocial(tiktokUrl, "TikTok")}
                  accessibilityRole="button"
                  accessibilityLabel="Voir le TikTok du vendeur"
                >
                  <Ionicons name="logo-tiktok" size={24} color="#fff" />
                </Pressable>
              ) : null}
              {instagramUrl ? (
                <Pressable
                  style={[shopProfileStyles.socialBtn, shopProfileStyles.ig]}
                  onPress={() => void openSocial(instagramUrl, "Instagram")}
                  accessibilityRole="button"
                  accessibilityLabel="Voir l’Instagram du vendeur"
                >
                  <Ionicons name="logo-instagram" size={26} color="#fff" />
                </Pressable>
              ) : null}
              {facebookUrl ? (
                <Pressable
                  style={[shopProfileStyles.socialBtn, shopProfileStyles.fb]}
                  onPress={() => void openSocial(facebookUrl, "Facebook")}
                  accessibilityRole="button"
                  accessibilityLabel="Voir le Facebook du vendeur"
                >
                  <Ionicons name="logo-facebook" size={26} color="#fff" />
                </Pressable>
              ) : null}
              {xUrl ? (
                <Pressable
                  style={[shopProfileStyles.socialBtn, shopProfileStyles.x]}
                  onPress={() => void openSocial(xUrl, "X")}
                  accessibilityRole="button"
                  accessibilityLabel="Voir le compte X du vendeur"
                >
                  <Ionicons name="logo-twitter" size={24} color="#fff" />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <Pressable
            style={shopProfileStyles.linkCard}
            onPress={() => void shareShop()}
            accessibilityRole="button"
            accessibilityLabel="Partager le lien de la boutique"
          >
            <Ionicons name="link-outline" size={18} color={colors.emerald} />
            <Text style={shopProfileStyles.linkText} numberOfLines={1}>
              {shopUrl.replace(/^https?:\/\//, "")}
            </Text>
            <Ionicons name="share-outline" size={18} color="#fff" />
          </Pressable>

          <View style={shopProfileStyles.tools}>
            {phone ? (
              <Pressable
                style={shopProfileStyles.toolChip}
                onPress={() => void openUrl(`tel:${phone}`)}
                accessibilityRole="button"
              >
                <Ionicons name="call" size={16} color={colors.emerald} />
                <Text style={shopProfileStyles.toolText}>{phone}</Text>
              </Pressable>
            ) : (
              <View style={shopProfileStyles.toolChip}>
                <Ionicons name="call-outline" size={16} color={colors.muted} />
                <Text style={shopProfileStyles.toolMuted}>
                  Contact non publié
                </Text>
              </View>
            )}
            <Pressable
              style={shopProfileStyles.toolChip}
              onPress={() => setShowAddress((value) => !value)}
              accessibilityRole="button"
            >
              <Ionicons name="location-outline" size={16} color="#fff" />
              <Text style={shopProfileStyles.toolText}>Adresse</Text>
            </Pressable>
            <Pressable
              style={shopProfileStyles.toolChip}
              onPress={() => void messageSeller()}
              accessibilityRole="button"
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={16}
                color="#fff"
              />
              <Text style={shopProfileStyles.toolText}>Message</Text>
            </Pressable>
          </View>

          {showAddress ? (
            <View style={shopProfileStyles.addressBox}>
              <Text style={shopProfileStyles.addressTitle}>
                {detail?.addressHint ?? "Adresse non publiée"}
              </Text>
              {detail?.lat != null && detail.lng != null ? (
                <Text style={shopProfileStyles.addressMeta}>
                  {detail.lat.toFixed(5)}, {detail.lng.toFixed(5)}
                </Text>
              ) : null}
              {mapsUrl ? (
                <Pressable onPress={() => void openUrl(mapsUrl)}>
                  <Text style={shopProfileStyles.addressLink}>
                    Ouvrir dans Maps
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={shopProfileStyles.section}>
            <View style={shopProfileStyles.productsHead}>
              <Text style={shopProfileStyles.productsTitle}>
                Produits actifs
              </Text>
              <Text style={shopProfileStyles.productsCount}>
                {compactCount(productCount)}
              </Text>
            </View>
            {loading ? (
              <ActivityIndicator color={colors.buyEnd} />
            ) : displayedProducts.length === 0 ? (
              <Text style={shopProfileStyles.emptyProducts}>
                Aucun produit actif pour le moment.
              </Text>
            ) : (
              <>
                <View style={shopProfileStyles.grid}>
                  {displayedProducts.map((product) => {
                    const isCurrent = product.id === activeProduct?.id;
                    return (
                      <Pressable
                        key={product.id}
                        style={[
                          shopProfileStyles.productCard,
                          isCurrent && shopProfileStyles.currentProduct,
                        ]}
                        onPress={() => openProduct(product.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Ouvrir ${product.title}`}
                      >
                        <Image
                          source={{ uri: coverOf(product.images) ?? undefined }}
                          style={shopProfileStyles.productCover}
                          contentFit="cover"
                        />
                        {isCurrent ? (
                          <Text style={shopProfileStyles.productTag}>
                            Produit en cours
                          </Text>
                        ) : null}
                        <Text
                          style={shopProfileStyles.productTitle}
                          numberOfLines={2}
                        >
                          {product.title}
                        </Text>
                        <Text style={shopProfileStyles.productPrice}>
                          {formatMoney(product.priceCents, product.currency)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {visibleProducts.length > PRODUCT_PREVIEW ? (
                  <Pressable
                    style={shopProfileStyles.moreProducts}
                    onPress={() => {
                      if (showAllProducts) openShop();
                      else setShowAllProducts(true);
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={shopProfileStyles.moreProductsText}>
                      {showAllProducts
                        ? "Voir tous les produits de la boutique"
                        : `Voir plus (${visibleProducts.length - PRODUCT_PREVIEW})`}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}
            {loadError ? (
              <Text style={shopProfileStyles.error}>{loadError}</Text>
            ) : null}
          </View>

          <Pressable
            style={[
              shopProfileStyles.follow,
              followed && shopProfileStyles.followOff,
            ]}
            onPress={onFollow}
            accessibilityRole="button"
            accessibilityLabel={followed ? "Ne plus suivre" : "Suivre"}
          >
            <Text style={shopProfileStyles.followText}>
              {followed ? "Ne plus suivre" : "Suivre"}
              {"\u00A0"}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}
