import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, isVideoUrl, mediaUrl } from "@/src/api";
import { parseCart } from "@/src/cart";
import { cartQueryKey } from "@/src/cart-store";
import { formatMoney } from "@/src/format";
import { coverOf, mediaList } from "@/src/media";
import { safeBack } from "@/src/nav";
import { saveCartLine } from "@/src/offline/writes";
import { useSession } from "@/src/session";
import { productInStock, productStock } from "@/src/stock";
import { showToast } from "@/src/toast";
import type { Product } from "@/src/types";
import { useColors } from "@/src/use-colors";

export default function PublishedProductScreen() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const queryClient = useQueryClient();
  const token = useSession((s) => s.token);
  const openAuth = useSession((s) => s.openAuth);
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({
    queryKey: ["product", id],
    enabled: Boolean(id),
    queryFn: () => api<{ product?: Product }>(`/api/products/${id}`),
  });
  const product = query.data?.product;
  const gallery = useMemo(
    () => (product ? mediaList(product.images) : []),
    [product],
  );
  const [activeUri, setActiveUri] = useState<string | null>(null);
  const cover = activeUri ?? (product ? coverOf(product.images) : null);
  const hasVideo = Boolean(product?.images.some((url) => isVideoUrl(url)));

  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [stock, setStock] = useState(0);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!product) return;
    setSize(product.sizes[0] ?? null);
    setColor(product.colors[0] ?? null);
    const next = productStock(product);
    setStock(next);
    setQty(next > 0 ? 1 : 0);
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    void api<{
      product?: { quantity?: number; status?: string; soldCount?: number };
    }>(`/api/products/${product.id}`)
      .then((data) => {
        if (!data.product) return;
        const next = productStock(data.product);
        setStock(next);
        setQty((current) => {
          if (next <= 0) return 0;
          return Math.min(Math.max(1, current), next);
        });
      })
      .catch(() => undefined);
  }, [product?.id]);

  async function addToBag() {
    if (!product) return;
    if (!token) {
      openAuth();
      return;
    }
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
      showToast("Ajouté au sac", "success");
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Ajout impossible",
        "error",
      );
    } finally {
      setPending(false);
    }
  }

  const inStock =
    stock > 0 && (!product?.status || product.status === "ACTIVE");

  return (
    <View style={[ui.root, { backgroundColor: c.background }]}>
      <View style={[ui.head, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => safeBack()} style={ui.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={c.text} />
          <Text style={[ui.backText, { color: c.text }]}>Retour</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/(tabs)/cart" as Href)}
          hitSlop={8}
          style={ui.bagHit}
          accessibilityLabel="Ouvrir le sac"
        >
          <Ionicons name="bag-handle-outline" size={22} color={c.text} />
        </Pressable>
      </View>

      {query.isLoading ? (
        <ActivityIndicator color={c.emerald} style={{ marginTop: 40 }} />
      ) : !product ? (
        <Text style={[ui.empty, { color: c.textMuted }]}>
          Publication introuvable
        </Text>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: insets.bottom + 120,
            }}
          >
            <View style={ui.hero}>
              {cover ? (
                <Image
                  source={{ uri: mediaUrl(cover) ?? cover }}
                  style={ui.cover}
                  contentFit="cover"
                />
              ) : (
                <View style={[ui.cover, { backgroundColor: c.sheet }]} />
              )}
              {hasVideo ? (
                <View style={ui.liveBadge}>
                  <Ionicons name="play" size={14} color="#fff" />
                  <Text style={ui.liveText}>Vidéo</Text>
                </View>
              ) : null}
            </View>

            {gallery.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={ui.gallery}
                style={{ marginBottom: 12 }}
              >
                {gallery.map((uri) => {
                  const on = (activeUri ?? gallery[0]) === uri;
                  return (
                    <Pressable key={uri} onPress={() => setActiveUri(uri)}>
                      <Image
                        source={{ uri }}
                        style={[ui.galleryThumb, on && ui.galleryThumbOn]}
                        contentFit="cover"
                      />
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            <Text style={[ui.title, { color: c.text }]}>{product.title}</Text>
            <Text style={[ui.price, { color: c.emerald }]}>
              {formatMoney(product.priceCents, product.currency)}
            </Text>
            {product.shop?.name ? (
              <Text style={[ui.meta, { color: c.textMuted }]}>
                {product.shop.name}
                {product.category ? ` · ${product.category}` : ""}
              </Text>
            ) : null}
            {product.description ? (
              <Text style={[ui.body, { color: c.textMuted }]}>
                {product.description}
              </Text>
            ) : null}

            {product.sizes.length > 0 ? (
              <View style={ui.optionBlock}>
                <Text style={[ui.optionLabel, { color: c.text }]}>Taille</Text>
                <View style={ui.chips}>
                  {product.sizes.map((s) => {
                    const on = size === s;
                    return (
                      <Pressable
                        key={s}
                        onPress={() => setSize(s)}
                        style={[
                          ui.chip,
                          {
                            borderColor: on
                              ? c.primary
                              : "rgba(255,255,255,0.12)",
                            backgroundColor: on
                              ? "rgba(255,90,31,0.16)"
                              : c.sheet,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: on ? c.primary : c.text,
                            fontWeight: "700",
                          }}
                        >
                          {s}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {product.colors.length > 0 ? (
              <View style={ui.optionBlock}>
                <Text style={[ui.optionLabel, { color: c.text }]}>Couleur</Text>
                <View style={ui.chips}>
                  {product.colors.map((col) => {
                    const on = color === col;
                    return (
                      <Pressable
                        key={col}
                        onPress={() => setColor(col)}
                        style={[
                          ui.chip,
                          {
                            borderColor: on
                              ? c.primary
                              : "rgba(255,255,255,0.12)",
                            backgroundColor: on
                              ? "rgba(255,90,31,0.16)"
                              : c.sheet,
                          },
                        ]}
                      >
                        <View
                          style={[
                            ui.swatch,
                            {
                              backgroundColor: col.startsWith("#")
                                ? col
                                : "#888",
                            },
                          ]}
                        />
                        <Text
                          style={{
                            color: on ? c.primary : c.text,
                            fontWeight: "700",
                            fontSize: 12,
                          }}
                        >
                          {col}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {inStock ? (
              <View style={ui.optionBlock}>
                <Text style={[ui.optionLabel, { color: c.text }]}>
                  Quantité
                </Text>
                <View style={ui.qtyRow}>
                  <Pressable
                    disabled={pending || qty <= 1}
                    onPress={() => setQty((v) => Math.max(1, v - 1))}
                    style={[ui.qtyBtn, { backgroundColor: c.sheet }]}
                  >
                    <Ionicons name="remove" size={16} color={c.text} />
                  </Pressable>
                  <Text style={[ui.qtyValue, { color: c.text }]}>{qty}</Text>
                  <Pressable
                    disabled={pending || qty >= stock}
                    onPress={() => setQty((v) => Math.min(stock, v + 1))}
                    style={[ui.qtyBtn, { backgroundColor: c.sheet }]}
                  >
                    <Ionicons name="add" size={16} color={c.text} />
                  </Pressable>
                  <Text style={{ color: c.textMuted, fontSize: 12 }}>
                    max {stock}
                  </Text>
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View
            style={[
              ui.footer,
              {
                paddingBottom: Math.max(14, insets.bottom + 8),
                backgroundColor: c.background,
                borderTopColor: "rgba(255,255,255,0.08)",
              },
            ]}
          >
            <Pressable
              onPress={() => void addToBag()}
              disabled={pending || !inStock}
              style={({ pressed }) => [
                ui.ctaWrap,
                pressed && { transform: [{ scale: 0.98 }] },
                (pending || !inStock) && { opacity: 0.7 },
              ]}
              accessibilityLabel="Ajouter au sac"
            >
              <LinearGradient
                colors={
                  !inStock ? ["#8d8d98", "#6b6b76"] : [c.buyStart, c.buyEnd]
                }
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={ui.cta}
              >
                {pending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="bag-handle" size={18} color="#fff" />
                    <Text style={ui.ctaText}>
                      {!inStock ? "Rupture de stock" : "Ajouter au sac"}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const ui = StyleSheet.create({
  root: { flex: 1 },
  head: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  backText: { fontWeight: "700", fontSize: 16, marginLeft: 4 },
  bagHit: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { textAlign: "center", marginTop: 40 },
  hero: { borderRadius: 20, overflow: "hidden", marginBottom: 16 },
  cover: {
    width: "100%",
    minHeight: 280,
    aspectRatio: 4 / 5,
    backgroundColor: "#0E0E14",
  },
  gallery: { gap: 10, paddingVertical: 4 },
  galleryThumb: {
    width: 72,
    height: 90,
    borderRadius: 12,
    backgroundColor: "#16161F",
  },
  galleryThumbOn: { borderWidth: 2, borderColor: "#00D68F" },
  liveBadge: {
    position: "absolute",
    left: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.62)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveText: { color: "#fff", fontWeight: "800", fontSize: 12, marginLeft: 4 },
  title: { fontSize: 24, fontWeight: "800" },
  price: { marginTop: 6, fontSize: 20, fontWeight: "800" },
  meta: { marginTop: 6, fontSize: 14 },
  body: { marginTop: 14, fontSize: 15, lineHeight: 22 },
  optionBlock: { marginTop: 18, gap: 10 },
  optionLabel: { fontSize: 14, fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyValue: {
    fontSize: 17,
    fontWeight: "800",
    minWidth: 24,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ctaWrap: { borderRadius: 16, overflow: "hidden" },
  cta: {
    minHeight: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
