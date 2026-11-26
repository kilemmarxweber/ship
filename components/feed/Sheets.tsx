import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
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

import { ShopLiveAvatar } from "@/components/feed/ShopLiveAvatar";
import { ShopQrButton } from "@/components/shop/ShopQrButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Face } from "@/components/ui/Face";
import { IconBackButton } from "@/components/ui/IconBackButton";
import { SheetReduce } from "@/components/ui/SheetReduce";
import { api, apiOrigin } from "@/src/api";
import { compactCount, formatMoney } from "@/src/format";
import { useMe } from "@/src/me";
import { coverOf } from "@/src/media";
import { snapshotGet } from "@/src/offline/db";
import { commentsSnapKey } from "@/src/offline/keys";
import { persistComments } from "@/src/offline/persist";
import { requestOrQueue } from "@/src/offline/writes";
import { usePrefs } from "@/src/prefs";
import { useSession } from "@/src/session";
import { colors, HAIRLINE } from "@/src/theme";
import { showToast } from "@/src/toast";
import type { CommentItem, Product, ShopCard } from "@/src/types";
import { useColors } from "@/src/use-colors";

function commentAge(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} j`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks} sem`;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

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
      presentationStyle="fullScreen"
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
  const c = useColors();
  const dark = usePrefs((state) => state.theme) !== "light";
  const token = useSession((state) => state.token);
  const me = useMe();
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const profile = useQuery({
    queryKey: ["profile", token ?? "guest"],
    enabled: Boolean(token),
    staleTime: 60_000,
    queryFn: () =>
      api<{ user?: { name?: string; image?: string | null } }>("/api/profile"),
  });
  const myName = profile.data?.user?.name || "Moi";
  const myImage = profile.data?.user?.image ?? null;
  const listRef = useRef<FlatList<CommentItem>>(null);
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
  const [replyName, setReplyName] = useState<string | null>(null);
  const [reaction, setReaction] = useState<Record<string, "up" | "down">>({});

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
      (event) => {
        setKeyboard(event.endCoordinates.height);
        requestAnimationFrame(() =>
          listRef.current?.scrollToEnd({ animated: true }),
        );
      },
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
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 320);
    const scrollTimer = setTimeout(
      () => listRef.current?.scrollToEnd({ animated: false }),
      120,
    );
    return () => {
      clearTimeout(focusTimer);
      clearTimeout(scrollTimer);
    };
  }, [product.id]);

  useEffect(() => {
    if (!items.length) return;
    const timer = setTimeout(
      () => listRef.current?.scrollToEnd({ animated: true }),
      60,
    );
    return () => clearTimeout(timer);
  }, [items.length]);

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
      user: { id: myId ?? "me", name: myName, image: myImage },
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
      setReplyName(null);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        listRef.current?.scrollToEnd({ animated: true });
      });
    } catch (cause) {
      setItems((current) => current.filter((row) => row.id !== optimistic.id));
      setError(cause instanceof Error ? cause.message : "Envoi impossible");
    }
  }

  function reply(name: string) {
    setReplyName(name);
    setBody((current) => {
      const mention = `@${name} `;
      if (current.startsWith(mention)) return current;
      return `${mention}${current.replace(/^@\S+\s+/, "")}`;
    });
    inputRef.current?.focus();
  }

  function toggleReaction(id: string, next: "up" | "down") {
    setReaction((current) => {
      if (current[id] === next) {
        const copy = { ...current };
        delete copy[id];
        return copy;
      }
      return { ...current, [id]: next };
    });
  }

  const ready = Boolean(body.trim());
  const dockPad = keyboard > 0 ? 8 : Math.max(12, insets.bottom + 8);

  return (
    <KeyboardAvoidingView
      style={[
        styles.commentsRoot,
        {
          paddingTop: insets.top + 4,
          backgroundColor: c.background,
        },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
    >
      <View style={styles.commentsHeader}>
        <IconBackButton color={c.text} onPress={onClose} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.commentsTitle, { color: c.text }]}>
            Commentaires
          </Text>
          <Text
            style={[styles.commentsSub, { color: c.textMuted }]}
            numberOfLines={1}
          >
            {product.title}
          </Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        style={{ flex: 1 }}
        contentContainerStyle={styles.commentsList}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: false })
        }
        renderItem={({ item }) => {
          const mark = reaction[item.id];
          return (
            <View
              style={[
                styles.commentCard,
                {
                  backgroundColor: c.card,
                  boxShadow: dark
                    ? "0 1px 2px rgba(0,0,0,0.45)"
                    : "0 1px 3px rgba(15,15,22,0.08)",
                },
              ]}
            >
              <Face uri={item.user.image} name={item.user.name} size={36} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={[styles.commentName, { color: c.text }]}
                  numberOfLines={1}
                >
                  {item.user.name}
                </Text>
                <Text
                  selectable
                  style={[styles.commentBody, { color: c.text }]}
                >
                  {item.body}
                </Text>
                <View style={styles.commentMeta}>
                  <Text style={[styles.commentTime, { color: c.textMuted }]}>
                    {commentAge(item.createdAt)}
                  </Text>
                  <Pressable
                    onPress={() => reply(item.user.name)}
                    accessibilityRole="button"
                    accessibilityLabel={`Répondre à ${item.user.name}`}
                    hitSlop={8}
                  >
                    <Text style={[styles.commentReply, { color: c.textMuted }]}>
                      Répondre
                    </Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.commentActs}>
                <Pressable
                  onPress={() => toggleReaction(item.id, "up")}
                  accessibilityRole="button"
                  accessibilityLabel="J'aime"
                  accessibilityState={{ selected: mark === "up" }}
                  hitSlop={6}
                  style={styles.commentIcon}
                >
                  <Ionicons
                    name={mark === "up" ? "heart" : "heart-outline"}
                    size={18}
                    color={mark === "up" ? c.live : c.textMuted}
                  />
                </Pressable>
                <Pressable
                  onPress={() => toggleReaction(item.id, "down")}
                  accessibilityRole="button"
                  accessibilityLabel="Je n'aime pas"
                  accessibilityState={{ selected: mark === "down" }}
                  hitSlop={6}
                  style={styles.commentIcon}
                >
                  <Ionicons
                    name={
                      mark === "down" ? "thumbs-down" : "thumbs-down-outline"
                    }
                    size={18}
                    color={c.textMuted}
                  />
                </Pressable>
                {canDelete(item) ? (
                  <Pressable
                    onPress={() => setCommentToDelete(item)}
                    hitSlop={6}
                    style={styles.commentIcon}
                    accessibilityLabel="Retirer le commentaire"
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={c.textMuted}
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: c.textMuted }]}>
            Aucun commentaire
          </Text>
        }
      />

      <View
        style={[
          styles.composerDock,
          {
            paddingBottom: dockPad,
            borderTopColor: dark ? "rgba(255,255,255,0.08)" : HAIRLINE,
            backgroundColor: c.background,
          },
        ]}
      >
        {replyName ? (
          <View style={styles.replyBar}>
            <Text
              style={[styles.replyHint, { color: c.textMuted, flex: 1 }]}
              numberOfLines={1}
            >
              Réponse à {replyName}
            </Text>
            <Pressable
              onPress={() => {
                setReplyName(null);
                setBody((current) => current.replace(/^@\S+\s+/, ""));
              }}
              hitSlop={8}
              accessibilityLabel="Annuler la réponse"
            >
              <Ionicons name="close" size={16} color={c.textMuted} />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.composerRow}>
          <Face uri={myImage} name={myName} size={30} />
          <TextInput
            ref={inputRef}
            value={body}
            onChangeText={setBody}
            placeholder="Ajouter un commentaire…"
            placeholderTextColor={dark ? "rgba(255,255,255,0.35)" : "#8E8E93"}
            style={[
              styles.composerInput,
              {
                backgroundColor: dark ? "#1C1C1E" : "#F2F2F7",
                color: dark ? "#fff" : c.text,
                ...(Platform.OS === "web"
                  ? ({ outlineStyle: "none", outlineWidth: 0 } as object)
                  : null),
              },
            ]}
            multiline
            textAlignVertical="center"
            autoFocus
            blurOnSubmit={false}
          />
          <Pressable
            onPress={() => void send()}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityLabel="Publier le commentaire"
            style={[styles.composerSend, { opacity: ready ? 1 : 0.35 }]}
          >
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

export { BuySheet } from "@/components/feed/BuySheet";

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  commentsRoot: { flex: 1, paddingHorizontal: 12 },
  commentsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  commentsTitle: { fontSize: 17, fontWeight: "700" },
  commentsSub: { fontWeight: "500", fontSize: 12, marginTop: 1 },
  commentsList: { gap: 10, paddingBottom: 8, flexGrow: 1 },
  commentCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 18,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  commentName: { fontSize: 15, fontWeight: "700" },
  commentBody: { fontSize: 15, lineHeight: 21, fontWeight: "400" },
  commentMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 4,
  },
  commentTime: { fontSize: 13, fontWeight: "500" },
  commentReply: { fontSize: 13, fontWeight: "700" },
  commentActs: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
  },
  commentIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  replyHint: { fontSize: 12, fontWeight: "600" },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  composerDock: {
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  composerInput: {
    flex: 1,
    minHeight: 34,
    maxHeight: 88,
    borderRadius: 17,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 14,
  },
  composerSend: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0A84FF",
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { color: colors.muted, paddingVertical: 12 },
  sendText: { color: "#04281c", fontWeight: "800" },
  error: { color: "#ff8a8a", paddingHorizontal: 4 },
  ok: { color: colors.emerald, fontWeight: "700" },
  cover: { width: 72, height: 72, borderRadius: 12 },
  price: { fontSize: 18, fontWeight: "800", color: colors.emerald },
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
    gap: 4,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 14,
  },
  linkMain: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: colors.buyEnd,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    overflow: "visible",
  },
  followOff: { backgroundColor: "#DC2626" },
  followText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.2,
    includeFontPadding: false,
    textAlign: "center",
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

          <View style={shopProfileStyles.linkCard}>
            <Pressable
              style={shopProfileStyles.linkMain}
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
            <ShopQrButton
              shopUrl={shopUrl}
              shopName={shop.name}
              bare
              iconColor="#fff"
            />
          </View>

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
            <Text
              style={shopProfileStyles.followText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {followed ? "Ne\u00A0plus\u00A0suivre" : "Suivre"}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}
