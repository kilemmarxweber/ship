import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SheetReduce } from "@/components/ui/SheetReduce";
import { api, mediaUrl } from "@/src/api";
import { formatMoney } from "@/src/format";
import type { Product } from "@/src/types";

type CatalogRow = {
  id: string;
  title: string;
  description?: string | null;
  images: string[];
  priceCents: number;
  currency?: string;
  shop?: { id?: string; name?: string; slug?: string };
};

export function LiveProductsSheet({
  open,
  liveId,
  shopId,
  isHost,
  featured,
  presentedProductId,
  scrollY = 0,
  seed,
  onClose,
  onView,
  onClearView,
  onScroll,
  onBuy,
}: {
  open: boolean;
  liveId: string;
  shopId?: string;
  isHost: boolean;
  featured?: Product | null;
  presentedProductId?: string | null;
  scrollY?: number;
  seed?: CatalogRow[];
  onClose: () => void;
  onView: (product: Product) => void;
  onClearView?: () => void;
  onScroll?: (ratio: number) => void;
  onBuy?: (product: Product) => void;
}) {
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<Product | null>(null);
  const listRef = useRef<FlatList<CatalogRow>>(null);
  const viewH = useRef(1);
  const contentH = useRef(1);
  const catalog = useQuery({
    queryKey: ["live-products", liveId, shopId ?? ""],
    enabled: Boolean(liveId),
    staleTime: 20_000,
    queryFn: async (): Promise<CatalogRow[]> => {
      try {
        const data = await api<{ products?: CatalogRow[] }>(
          `/api/growth/lives/${liveId}/products`,
        );
        return data.products ?? [];
      } catch {
        if (seed?.length) return seed;
        if (!shopId) return featured ? [toRow(featured)] : [];
        const params = new URLSearchParams({ shopId });
        const data = await api<{ products?: CatalogRow[] }>(
          `/api/products?${params}`,
        );
        return data.products ?? [];
      }
    },
    initialData: seed?.length ? seed : undefined,
  });

  const rows = useMemo(() => {
    const list =
      catalog.data && catalog.data.length > 0 ? catalog.data : (seed ?? []);
    if (featured && !list.some((row) => row.id === featured.id)) {
      return [toRow(featured), ...list];
    }
    return list;
  }, [catalog.data, featured, seed]);

  useEffect(() => {
    if (!open) {
      setDetail(null);
      return;
    }
    if (!presentedProductId) {
      setDetail(null);
      return;
    }
    const hit = rows.find((row) => row.id === presentedProductId);
    if (hit) {
      setDetail(asProduct(hit, shopId));
      return;
    }
    let cancel = false;
    void api<{ product?: Product }>(`/api/products/${presentedProductId}`)
      .then((data) => {
        if (!cancel && data.product) setDetail(data.product);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [isHost, open, presentedProductId, rows, shopId]);

  useEffect(() => {
    if (isHost || detail) return;
    const max = Math.max(1, contentH.current - viewH.current);
    listRef.current?.scrollToOffset({
      offset: scrollY * max,
      animated: false,
    });
  }, [detail, isHost, scrollY, rows.length]);

  function openDetail(row: CatalogRow) {
    if (!isHost) return;
    const product = asProduct(row, shopId);
    setDetail(product);
    onView(product);
  }

  function closeDetail() {
    if (!isHost) return;
    setDetail(null);
    onClearView?.();
  }

  function onListScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!isHost) return;
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    contentH.current = contentSize.height;
    viewH.current = layoutMeasurement.height;
    const max = Math.max(1, contentSize.height - layoutMeasurement.height);
    onScroll?.(Math.min(1, Math.max(0, contentOffset.y / max)));
  }

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={
        isHost ? (detail ? closeDetail : onClose) : () => undefined
      }
    >
      <View style={styles.frame}>
        {isHost ? (
          <Pressable
            style={styles.backdrop}
            onPress={detail ? closeDetail : onClose}
          />
        ) : (
          <View style={styles.backdrop} />
        )}
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          {isHost ? (
            <SheetReduce onPress={detail ? closeDetail : onClose} />
          ) : (
            <View style={styles.handle} />
          )}
          {detail ? (
            <ProductExplain
              product={detail}
              isHost={isHost}
              onBack={closeDetail}
              onBuy={
                onBuy && !isHost
                  ? () => {
                      onBuy(detail);
                    }
                  : undefined
              }
            />
          ) : (
            <>
              <View style={styles.head}>
                <Text style={styles.title}>Produits ({rows.length})</Text>
                {isHost ? null : <Text style={styles.liveHint}>En direct</Text>}
              </View>
              <Text style={styles.hint}>
                {isHost
                  ? "Tes spectateurs voient et suivent cette liste. Touche Voir pour expliquer un produit."
                  : "Lecture seule — le diffuseur contrôle le défilement."}
              </Text>
              {catalog.isLoading && rows.length === 0 ? (
                <ActivityIndicator color="#00D68F" style={{ marginTop: 24 }} />
              ) : (
                <FlatList
                  ref={listRef}
                  data={rows}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={isHost}
                  bounces={isHost}
                  overScrollMode={isHost ? "auto" : "never"}
                  onScroll={onListScroll}
                  scrollEventThrottle={32}
                  onLayout={(event) => {
                    viewH.current = event.nativeEvent.layout.height;
                  }}
                  onContentSizeChange={(_w, h) => {
                    contentH.current = h;
                  }}
                  contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
                  renderItem={({ item }) => {
                    const thumb = mediaUrl(item.images?.[0]);
                    return (
                      <Pressable
                        style={styles.row}
                        disabled={!isHost}
                        onPress={() => openDetail(item)}
                      >
                        {thumb ? (
                          <Image
                            source={{ uri: thumb }}
                            style={styles.thumb}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={styles.thumb} />
                        )}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.rowTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={styles.price}>
                            {formatMoney(item.priceCents, item.currency)}
                          </Text>
                          {item.description ? (
                            <Text style={styles.rowDesc} numberOfLines={1}>
                              {item.description}
                            </Text>
                          ) : null}
                        </View>
                        {isHost ? (
                          <View style={styles.see}>
                            <Text style={styles.seeText}>Voir</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  }}
                  ListEmptyComponent={
                    <Text style={styles.empty}>
                      Aucun produit pour ce live.
                    </Text>
                  }
                />
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ProductExplain({
  product,
  isHost,
  onBack,
  onBuy,
}: {
  product: Product;
  isHost: boolean;
  onBack: () => void;
  onBuy?: () => void;
}) {
  const photos = product.images.filter((url) => !/\.(mp4|webm|mov)/i.test(url));
  const cover = mediaUrl(photos[0] ?? product.images[0]);

  return (
    <View style={{ flexShrink: 1, minHeight: 280 }}>
      <View style={styles.head}>
        {isHost ? (
          <Pressable onPress={onBack} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
            <Text style={styles.backText}>Liste</Text>
          </Pressable>
        ) : (
          <Text style={styles.liveHint}>En direct</Text>
        )}
        <Text style={styles.title} numberOfLines={1}>
          {isHost ? "Présenter" : "Détail"}
        </Text>
        {isHost ? (
          <Pressable onPress={onBack} hitSlop={8}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
      >
        {photos.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {photos.map((url) => {
              const src = mediaUrl(url);
              if (!src) return null;
              return (
                <Image
                  key={url}
                  source={{ uri: src }}
                  style={styles.gallery}
                  contentFit="cover"
                />
              );
            })}
          </ScrollView>
        ) : cover ? (
          <Image
            source={{ uri: cover }}
            style={styles.hero}
            contentFit="cover"
          />
        ) : (
          <View style={styles.hero} />
        )}
        <Text style={styles.detailTitle}>{product.title}</Text>
        <Text style={styles.detailPrice}>
          {formatMoney(product.priceCents, product.currency)}
        </Text>
        {product.description ? (
          <Text style={styles.detailBody}>{product.description}</Text>
        ) : (
          <Text style={styles.detailMuted}>
            {isHost
              ? "Pas de description — explique le produit à l’oral."
              : "Le diffuseur présente ce produit."}
          </Text>
        )}
        {onBuy ? (
          <Pressable style={styles.buy} onPress={onBuy}>
            <Text style={styles.buyText}>Acheter</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function toRow(product: Product): CatalogRow {
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    images: product.images,
    priceCents: product.priceCents,
    currency: product.currency,
    shop: product.shop,
  };
}

function asProduct(row: CatalogRow, shopId?: string): Product {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    priceCents: row.priceCents,
    currency: row.currency,
    images: row.images ?? [],
    colors: [],
    sizes: [],
    likesCount: 0,
    commentsCount: 0,
    likedByMe: false,
    shop: {
      id: row.shop?.id ?? shopId ?? "",
      name: row.shop?.name ?? "",
      slug: row.shop?.slug ?? "",
    },
  };
}

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    maxHeight: "78%",
    backgroundColor: "#121218",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: { color: "#fff", fontWeight: "800", fontSize: 16, flex: 1 },
  hint: { color: "rgba(255,255,255,0.5)", fontSize: 12, lineHeight: 16 },
  liveHint: { color: "#00D68F", fontWeight: "800", fontSize: 11 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 8,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#222",
  },
  rowTitle: { color: "#fff", fontWeight: "800", fontSize: 13 },
  price: { color: "#00D68F", fontWeight: "800", marginTop: 4 },
  rowDesc: { color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 },
  see: {
    backgroundColor: "#00D68F",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  seeText: { color: "#05140F", fontWeight: "800", fontSize: 12 },
  empty: {
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    marginTop: 24,
  },
  back: { flexDirection: "row", alignItems: "center", gap: 2 },
  backText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  hero: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    backgroundColor: "#222",
  },
  gallery: {
    width: 160,
    height: 180,
    borderRadius: 16,
    backgroundColor: "#222",
  },
  detailTitle: { color: "#fff", fontWeight: "800", fontSize: 18 },
  detailPrice: { color: "#00D68F", fontWeight: "800", fontSize: 16 },
  detailBody: { color: "rgba(255,255,255,0.78)", fontSize: 14, lineHeight: 20 },
  detailMuted: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    lineHeight: 18,
  },
  buy: {
    backgroundColor: "#00D68F",
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 12,
  },
  buyText: { color: "#05140F", fontWeight: "800", fontSize: 15 },
});
