import { Redirect } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BuySheet } from "@/components/feed/BuySheet";
import type { Product } from "@/src/types";
import { useColors } from "@/src/use-colors";

const PREVIEW_PRODUCT: Product = {
  id: "preview-buy-sheet",
  title: "Cutting Edge Poncho",
  description: "Preview UX Acheter",
  priceCents: 50000,
  currency: "USD",
  quantity: 12,
  soldCount: 128,
  status: "ACTIVE",
  category: "Mode",
  images: [
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=80",
    "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=900&q=80",
    "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&q=80",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&q=80",
    "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&q=80",
    "https://images.unsplash.com/photo-1445205170230-053b83016050?w=900&q=80",
    "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=900&q=80",
  ],
  colors: ["#7C3AED", "#111111", "#F5F5F5"],
  sizes: ["40", "42", "44", "46"],
  likesCount: 128,
  commentsCount: 24,
  sharesCount: 8,
  likedByMe: false,
  shop: {
    id: "preview-shop",
    name: "ShipShop Preview",
    slug: "preview",
  },
};

/**
 * Preview plein écran du BuySheet (clic Acheter) — __DEV__ only.
 * Ouvre /ui-preview-buy-sheet pour validation visuelle vs référence UX.
 */
export default function UiPreviewBuySheet() {
  const c = useColors();
  const [open, setOpen] = useState(true);

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <Pressable
        style={[styles.openBtn, { backgroundColor: c.emerald }]}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.openText}>Ouvrir Acheter</Text>
      </Pressable>
      <BuySheet
        product={open ? PREVIEW_PRODUCT : null}
        onClose={() => setOpen(false)}
        onAdded={() => undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },
  openBtn: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  openText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
