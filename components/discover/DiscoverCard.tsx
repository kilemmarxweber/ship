import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ReelGallery } from "@/components/feed/ReelGallery";
import { ReelCover, ReelSoundtrack } from "@/components/feed/ReelVideo";
import { isVideoUrl, mediaUrl } from "@/src/api";
import { compactCount, formatMoney } from "@/src/format";
import { mediaList, productHasAudio } from "@/src/media";
import { productInStock, stockAlertColor, stockFraction } from "@/src/stock";
import { colors } from "@/src/theme";
import type { Product } from "@/src/types";

export function DiscoverCard({
  product,
  width,
  height,
  playing,
  muted,
  videoBadge,
  delay,
  onFocus,
  onMute,
  onBuy,
}: {
  product: Product;
  width: number;
  height: number;
  playing: boolean;
  muted: boolean;
  videoBadge?: boolean;
  delay?: number;
  onFocus: () => void;
  onMute: () => void;
  onBuy: () => void;
}) {
  const urls = mediaList(product.images);
  const cover = urls.find((url) => !isVideoUrl(url)) ?? urls[0];
  const audio = productHasAudio(product);
  const inStock = productInStock(product);
  const promo =
    product.promoPercent && product.promoPercent > 0
      ? product.promoPercent
      : product.compareAtCents && product.compareAtCents > product.priceCents
        ? Math.round((1 - product.priceCents / product.compareAtCents) * 100)
        : null;

  return (
    <Animated.View
      entering={FadeInDown.delay(delay ?? 0)
        .springify()
        .damping(16)
        .stiffness(160)}
      style={[styles.wrap, { width, height }]}
    >
      {playing ? (
        <ReelGallery
          urls={urls}
          playing={playing}
          muted={muted || Boolean(product.soundtrack?.audioUrl)}
          width={width}
          height={height}
          onTap={() => {
            onFocus();
            if (audio) onMute();
          }}
          dotsBottom={12}
          restartToken={playing ? product.id : `${product.id}-off`}
        />
      ) : (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            onFocus();
            if (audio) onMute();
          }}
        >
          {cover ? <ReelCover uri={cover} /> : null}
        </Pressable>
      )}
      {product.soundtrack?.audioUrl && playing ? (
        <ReelSoundtrack
          uri={
            mediaUrl(product.soundtrack.audioUrl) ?? product.soundtrack.audioUrl
          }
          playing={playing}
          muted={muted}
        />
      ) : null}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.88)"]}
        style={styles.shade}
        pointerEvents="none"
      />
      {!inStock ? (
        <View style={styles.soldBadge}>
          <Text style={styles.soldBadgeText}>Rupture · plus en stock</Text>
        </View>
      ) : videoBadge || audio ? (
        <View style={styles.badge}>
          <Ionicons name="play" size={10} color="#fff" />
          <Text style={styles.badgeText}>Vidéo</Text>
        </View>
      ) : null}
      {audio ? (
        <Pressable
          onPress={() => {
            onFocus();
            onMute();
          }}
          hitSlop={8}
          style={styles.sound}
        >
          <Ionicons
            name={muted || !playing ? "volume-mute" : "volume-high"}
            size={16}
            color="#fff"
          />
        </Pressable>
      ) : null}
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={2}>
          {product.title}
        </Text>
        <Text style={styles.shop} numberOfLines={1}>
          {compactCount(product.commentsCount)} avis
          {"  "}
          <Text style={[styles.stockFrac, { color: stockAlertColor(product) }]}>
            stock {stockFraction(product)}
          </Text>
        </Text>
        <View style={styles.row}>
          <View style={styles.priceCol}>
            <Text style={styles.price}>
              {formatMoney(product.priceCents, product.currency)}
            </Text>
            {promo ? <Text style={styles.promo}>-{promo}%</Text> : null}
          </View>
          {inStock ? (
            <Pressable onPress={onBuy}>
              <LinearGradient
                colors={[colors.buyStart, colors.buyEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buy}
              >
                <Text style={styles.buyText}>Acheter</Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <View style={styles.soldBtn}>
              <Text style={styles.soldBtnText}>Épuisé</Text>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "#17171C",
  },
  shade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 150,
  },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  sound: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  meta: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    gap: 4,
  },
  title: { color: "#fff", fontWeight: "800", fontSize: 14 },
  stockFrac: { fontWeight: "800", fontSize: 13 },
  shop: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600" },
  row: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  priceCol: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  price: { color: colors.emerald, fontWeight: "800", fontSize: 13 },
  promo: {
    color: colors.emerald,
    fontWeight: "800",
    fontSize: 11,
    backgroundColor: "rgba(0,214,143,0.16)",
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  buy: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buyText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  soldBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(200, 16, 46, 0.92)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  soldBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  soldBtn: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  soldBtnText: {
    color: "rgba(255,255,255,0.8)",
    fontWeight: "800",
    fontSize: 11,
  },
});
