import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ShopLiveAvatar } from "@/components/feed/ShopLiveAvatar";
import { api } from "@/src/api";
import { compactCount, formatMoney } from "@/src/format";
import { coverOf } from "@/src/media";
import { HAIRLINE } from "@/src/theme";
import type { Product, ShopCard } from "@/src/types";
import { useColors } from "@/src/use-colors";

type ShopDetail = ShopCard & {
  description?: string | null;
  productsCount?: number;
  followersCount?: number;
  contactPhone?: string | null;
  addressHint?: string | null;
  alwaysOpen?: boolean | null;
  hoursStart?: string | null;
  hoursEnd?: string | null;
};

type ScrollHandle = {
  scrollTo: (opts: { y: number; animated?: boolean }) => void;
};

export function ShopPublicScreen() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const params = useLocalSearchParams<{ slug?: string; "#": string }>();
  const slug = String(params.slug ?? "");
  const hash = String(params["#"] ?? "");
  const scrollRef = useRef<ScrollHandle | null>(null);
  const productsY = useRef(0);

  const shopQ = useQuery({
    queryKey: ["shop", slug],
    enabled: Boolean(slug),
    queryFn: () => api<{ shop: ShopDetail }>(`/api/shops/${slug}`),
  });

  const productsQ = useQuery({
    queryKey: ["shop-products", shopQ.data?.shop?.id],
    enabled: Boolean(shopQ.data?.shop?.id),
    queryFn: () =>
      api<{ products: Product[] }>(
        `/api/products?shopId=${encodeURIComponent(shopQ.data!.shop.id)}&limit=48`,
      ),
  });

  const shop = shopQ.data?.shop;
  const products = productsQ.data?.products ?? [];

  const bindScroll = useCallback((node: ScrollHandle | null) => {
    scrollRef.current = node;
  }, []);

  useEffect(() => {
    if (hash !== "produits" || !shop || productsQ.isLoading) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, productsY.current - 12),
        animated: true,
      });
    }, 280);
    return () => clearTimeout(t);
  }, [hash, shop, productsQ.isLoading, products.length]);

  return (
    <View style={[ui.root, { backgroundColor: c.background }]}>
      <View style={[ui.head, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={ui.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={c.text} />
          <Text style={[ui.backText, { color: c.text }]}>Retour</Text>
        </Pressable>
      </View>

      {shopQ.isLoading ? (
        <ActivityIndicator color={c.emerald} style={{ marginTop: 40 }} />
      ) : !shop ? (
        <Text style={[ui.empty, { color: c.textMuted }]}>
          Boutique introuvable
        </Text>
      ) : (
        <ScrollView
          ref={bindScroll as never}
          contentContainerStyle={[
            ui.scroll,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={ui.hero}>
            <ShopLiveAvatar
              live
              logoUrl={shop.logoUrl}
              name={shop.name}
              size={72}
              onPress={() => undefined}
            />
            <Text style={[ui.name, { color: c.text }]}>{shop.name}</Text>
            <Text style={[ui.meta, { color: c.textMuted }]}>
              @{shop.slug}
              {typeof shop.followersCount === "number"
                ? ` · ${compactCount(shop.followersCount)} abonnés`
                : ""}
              {typeof shop.productsCount === "number"
                ? ` · ${compactCount(shop.productsCount)} produits`
                : ""}
            </Text>
            {shop.description ? (
              <Text style={[ui.desc, { color: c.textMuted }]}>
                {shop.description}
              </Text>
            ) : null}
          </View>

          <View
            onLayout={(event) => {
              productsY.current = event.nativeEvent.layout.y;
            }}
          >
            <Text style={[ui.section, { color: c.text }]}>Produits</Text>
            {productsQ.isLoading ? (
              <ActivityIndicator color={c.emerald} />
            ) : products.length === 0 ? (
              <Text style={{ color: c.textMuted }}>Aucun produit.</Text>
            ) : (
              <View style={ui.grid}>
                {products.map((product) => {
                  const cover = coverOf(product.images ?? []);
                  return (
                    <Pressable
                      key={product.id}
                      style={[ui.card, { backgroundColor: c.card }]}
                      onPress={() =>
                        router.push({
                          pathname: "/product/[id]",
                          params: { id: product.id },
                        })
                      }
                    >
                      <Image
                        source={{ uri: cover ?? undefined }}
                        style={ui.cover}
                      />
                      <Text
                        style={[ui.title, { color: c.text }]}
                        numberOfLines={2}
                      >
                        {product.title}
                      </Text>
                      <Text style={[ui.price, { color: c.emerald }]}>
                        {formatMoney(product.priceCents, product.currency)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const ui = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: 12, paddingBottom: 8 },
  back: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  backText: { fontWeight: "700", fontSize: 16, marginLeft: 4 },
  empty: { textAlign: "center", marginTop: 40 },
  scroll: { paddingHorizontal: 16, gap: 18 },
  hero: { alignItems: "center", gap: 8, paddingTop: 8 },
  name: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  meta: { fontSize: 13, textAlign: "center" },
  desc: { fontSize: 13, lineHeight: 18, textAlign: "center", marginTop: 4 },
  section: { fontSize: 18, fontWeight: "800", marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    width: "47.5%",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
  },
  cover: { width: "100%", aspectRatio: 1, backgroundColor: "#1a1a22" },
  title: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  price: {
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingBottom: 10,
    paddingTop: 4,
  },
});
