import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
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
import { formatMoney } from "@/src/format";
import { coverOf, mediaList } from "@/src/media";
import type { Product } from "@/src/types";
import { useColors } from "@/src/use-colors";

const ui = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: 12, paddingBottom: 8 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  backText: { fontWeight: "700", fontSize: 16, marginLeft: 4 },
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
  fitHint: {
    position: "absolute",
    left: 12,
    top: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  fitHintText: { color: "#fff", fontWeight: "700", fontSize: 11 },
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
  ok: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00D68F",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  okText: { color: "#04281c", fontWeight: "800", fontSize: 12, marginLeft: 4 },
  title: { fontSize: 24, fontWeight: "800" },
  price: { marginTop: 6, fontSize: 20, fontWeight: "800" },
  meta: { marginTop: 6, fontSize: 14 },
  body: { marginTop: 14, fontSize: 15, lineHeight: 22 },
});

export default function PublishedProductScreen() {
  const insets = useSafeAreaInsets();
  const c = useColors();
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

  return (
    <View style={[ui.root, { backgroundColor: c.background }]}>
      <View style={[ui.head, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={ui.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={c.text} />
          <Text style={[ui.backText, { color: c.text }]}>Retour</Text>
        </Pressable>
      </View>
      {query.isLoading ? (
        <ActivityIndicator color={c.emerald} style={{ marginTop: 40 }} />
      ) : !product ? (
        <Text style={[ui.empty, { color: c.textMuted }]}>
          Publication introuvable
        </Text>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 32,
          }}
        >
          <View style={ui.hero}>
            {cover ? (
              <Image
                source={{ uri: mediaUrl(cover) ?? cover }}
                style={ui.cover}
                contentFit="contain"
              />
            ) : (
              <View style={[ui.cover, { backgroundColor: c.sheet }]} />
            )}
            <View style={ui.fitHint}>
              <Text style={ui.fitHintText}>Contain · proportions gardées</Text>
            </View>
            {hasVideo ? (
              <View style={ui.liveBadge}>
                <Ionicons name="play" size={14} color="#fff" />
                <Text style={ui.liveText}>Vidéo</Text>
              </View>
            ) : null}
            <View style={ui.ok}>
              <Ionicons name="checkmark-circle" size={16} color="#04281c" />
              <Text style={ui.okText}>Publié</Text>
            </View>
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
        </ScrollView>
      )}
    </View>
  );
}
