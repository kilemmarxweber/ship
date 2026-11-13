import { safeBack } from "@/src/nav";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Linking,
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
import { api, apiOrigin } from "@/src/api";
import { compactCount, formatMoney } from "@/src/format";
import { matchOpenLive } from "@/src/live";
import { coverOf } from "@/src/media";
import { useOnline } from "@/src/offline/network";
import { useSession } from "@/src/session";
import { HAIRLINE } from "@/src/theme";
import { showToast } from "@/src/toast";
import type { LiveTeaser, Product, ShopCard } from "@/src/types";
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
  lat?: number | null;
  lng?: number | null;
  categories?: { id: string; count: number }[];
  tiktokUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  xUrl?: string | null;
};

function hoursLabel(shop: ShopDetail) {
  if (shop.alwaysOpen) return "Toujours disponible";
  const start = shop.hoursStart?.trim();
  const end = shop.hoursEnd?.trim();
  if (start && end) return `Ouvert ${start} – ${end}`;
  return null;
}

export function ShopPublicScreen() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const online = useOnline();
  const token = useSession((state) => state.token);
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ slug?: string; "#": string }>();
  const slug = String(params.slug ?? "");
  const hash = String(params["#"] ?? "");
  const scrollRef = useRef<FlatList<Product> | null>(null);
  const productsY = useRef(0);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [showAddress, setShowAddress] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);

  const shopQ = useQuery({
    queryKey: ["shop", slug],
    enabled: Boolean(slug),
    queryFn: () => api<{ shop: ShopDetail }>(`/api/shops/${slug}`),
  });

  const shop = shopQ.data?.shop;

  const productsQ = useQuery({
    queryKey: ["shop-products", shop?.id, debouncedQ, category],
    enabled: Boolean(shop?.id),
    queryFn: async () => {
      const params = new URLSearchParams({
        shopId: shop!.id,
        limit: "48",
        status: "ACTIVE",
      });
      if (debouncedQ) params.set("q", debouncedQ);
      if (category) params.set("category", category);
      return api<{ products: Product[] }>(`/api/products?${params}`);
    },
  });

  const livesQ = useQuery({
    queryKey: ["lives"],
    queryFn: () => api<{ lives: LiveTeaser[] }>("/api/growth/lives"),
    staleTime: 0,
    refetchInterval: (query) => {
      const open = (query.state.data?.lives ?? []).some(
        (row) => row.status !== "ENDED",
      );
      return open ? 2000 : 8000;
    },
  });

  const products = useMemo(
    () => productsQ.data?.products ?? [],
    [productsQ.data?.products],
  );
  const liveMatch = shop
    ? matchOpenLive(livesQ.data?.lives, { ownerUserId: shop.ownerUserId })
    : null;
  const liveOn = Boolean(liveMatch);
  const shopUrl = `${apiOrigin()}/shop/${slug}`;
  const refCode = slug.toUpperCase().slice(0, 12);
  const hours = shop ? hoursLabel(shop) : null;
  const mapsUrl =
    shop?.lat != null && shop?.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lng}`
      : null;

  const derivedCats = useMemo(() => {
    if ((shop?.categories?.length ?? 0) > 0 || debouncedQ || category) {
      return [];
    }
    const counts = new Map<string, number>();
    for (const product of products) {
      const id = product.category?.trim();
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()].map(([id, count]) => ({
      id,
      count,
      label: id,
    }));
  }, [shop?.categories, products, debouncedQ, category]);

  const categoryChips = useMemo(() => {
    const rows = shop?.categories ?? [];
    if (rows.length) {
      return rows.map((row) => ({
        id: row.id,
        count: row.count,
        label: row.id,
      }));
    }
    return derivedCats;
  }, [shop?.categories, derivedCats]);

  useEffect(() => {
    if (hash !== "produits" || !shop || productsQ.isLoading) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollToOffset({
        offset: Math.max(0, productsY.current - 12),
        animated: true,
      });
    }, 280);
    return () => clearTimeout(t);
  }, [hash, shop, productsQ.isLoading, products.length]);

  async function toggleFollow() {
    if (!shop) return;
    if (!token) {
      showToast("Connectez-vous pour suivre cette boutique.", "info");
      return;
    }
    if (followBusy) return;
    const was = Boolean(shop.followedByMe);
    setFollowBusy(true);
    queryClient.setQueryData(
      ["shop", slug],
      (prev: { shop: ShopDetail } | undefined) =>
        prev
          ? {
              shop: {
                ...prev.shop,
                followedByMe: !was,
                followersCount: Math.max(
                  0,
                  (prev.shop.followersCount ?? 0) + (was ? -1 : 1),
                ),
              },
            }
          : prev,
    );
    try {
      const data = await api<{
        followedByMe?: boolean;
        followersCount?: number;
      }>(`/api/shops/${shop.slug}/follow`, {
        method: was ? "DELETE" : "POST",
      });
      queryClient.setQueryData(
        ["shop", slug],
        (prev: { shop: ShopDetail } | undefined) =>
          prev
            ? {
                shop: {
                  ...prev.shop,
                  followedByMe:
                    typeof data.followedByMe === "boolean"
                      ? data.followedByMe
                      : !was,
                  followersCount:
                    typeof data.followersCount === "number"
                      ? data.followersCount
                      : prev.shop.followersCount,
                },
              }
            : prev,
      );
    } catch {
      queryClient.setQueryData(
        ["shop", slug],
        (prev: { shop: ShopDetail } | undefined) =>
          prev
            ? {
                shop: {
                  ...prev.shop,
                  followedByMe: was,
                  followersCount: Math.max(
                    0,
                    (prev.shop.followersCount ?? 0) + (was ? 1 : -1),
                  ),
                },
              }
            : prev,
      );
      showToast("Impossible de mettre à jour l'abonnement.", "error");
    } finally {
      setFollowBusy(false);
    }
  }

  async function openUrl(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      showToast("Application introuvable sur cet appareil.", "error");
    }
  }

  async function openWhatsApp(phone: string) {
    const digits = phone.replace(/\D/g, "");
    if (!digits) {
      showToast("Numéro WhatsApp invalide.", "info");
      return;
    }
    await openUrl(
      `https://wa.me/${digits}?text=${encodeURIComponent(
        `Bonjour, je vous contacte depuis ShipShop à propos de ${shop?.name ?? "votre boutique"}.`,
      )}`,
    );
  }

  async function shareShop() {
    if (!shop) return;
    try {
      await Share.share({
        message: `Découvre ${shop.name} sur ShipShop\n${shopUrl}`,
        url: shopUrl,
      });
    } catch {
      showToast("Partage impossible pour le moment.", "error");
    }
  }

  async function copyShopLink() {
    try {
      await Share.share({ message: shopUrl, url: shopUrl });
    } catch {
      showToast("Lien impossible à partager.", "error");
    }
  }

  async function messageSeller() {
    if (!shop) return;
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
      router.push({
        pathname: "/(tabs)/messages/[id]",
        params: { id: data.conversation.id },
      });
    } catch {
      showToast("Impossible d'ouvrir la conversation.", "error");
    }
  }

  function openAvatar() {
    if (liveMatch) {
      router.push(`/live/${liveMatch.id}` as Href);
      return;
    }
  }

  const followed = Boolean(shop?.followedByMe);
  const productsCount = shop?.productsCount ?? products.length;
  const followers = shop?.followersCount ?? 0;

  return (
    <View style={[ui.root, { backgroundColor: c.background }]}>
      <View
        style={[
          ui.head,
          {
            paddingTop: insets.top + 8,
            borderBottomColor: HAIRLINE,
            backgroundColor: c.background,
          },
        ]}
      >
        <Pressable onPress={() => safeBack()} style={ui.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={c.text} />
          <Text style={[ui.backText, { color: c.text }]}>Retour</Text>
        </Pressable>
      </View>

      {shopQ.isPending && slug ? (
        online ? (
          <ActivityIndicator color={c.emerald} style={{ marginTop: 40 }} />
        ) : (
          <View style={ui.offlineState}>
            <Text style={[ui.emptyHint, { color: c.textMuted }]}>
              Connexion indisponible
            </Text>
            <Pressable onPress={() => void shopQ.refetch()} style={ui.retryBtn}>
              <Text style={[ui.retryText, { color: c.primary }]}>
                Réessayer
              </Text>
            </Pressable>
          </View>
        )
      ) : !shop ? (
        <View style={ui.offlineState}>
          <Text style={[ui.empty, { color: c.textMuted }]}>
            {shopQ.isError
              ? "Boutique indisponible"
              : online
                ? "Boutique introuvable"
                : "Connexion indisponible"}
          </Text>
          {shopQ.isError || !online ? (
            <Pressable onPress={() => void shopQ.refetch()} style={ui.retryBtn}>
              <Text style={[ui.retryText, { color: c.primary }]}>
                Réessayer
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          ref={scrollRef}
          data={products}
          keyExtractor={(product) => product.id}
          numColumns={2}
          columnWrapperStyle={ui.gridRow}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={5}
          contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: product }) => {
            const cover = coverOf(product.images ?? []);
            return (
              <Pressable
                style={[
                  ui.card,
                  { backgroundColor: c.card, borderColor: HAIRLINE },
                ]}
                onPress={() =>
                  router.push({
                    pathname: "/product/[id]",
                    params: { id: product.id },
                  })
                }
              >
                {product.category ? (
                  <View style={ui.catBadge}>
                    <Text style={ui.catBadgeText}>{product.category}</Text>
                  </View>
                ) : null}
                <Image
                  source={{ uri: cover ?? undefined }}
                  style={ui.cover}
                  contentFit="cover"
                />
                <Text style={[ui.title, { color: c.text }]} numberOfLines={2}>
                  {product.title}
                </Text>
                <Text style={[ui.price, { color: c.emerald }]}>
                  {formatMoney(product.priceCents, product.currency)}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            productsQ.isPending ? (
              online ? (
                <ActivityIndicator
                  color={c.emerald}
                  style={{ marginTop: 24 }}
                />
              ) : (
                <View style={ui.emptyProducts}>
                  <Text style={[ui.emptyHint, { color: c.textMuted }]}>
                    {productsQ.isError
                      ? "Impossible de charger les produits."
                      : "Connexion indisponible"}
                  </Text>
                  <Pressable
                    onPress={() => void productsQ.refetch()}
                    style={ui.retryBtn}
                  >
                    <Text style={[ui.retryText, { color: c.primary }]}>
                      Réessayer
                    </Text>
                  </Pressable>
                </View>
              )
            ) : productsQ.isError ? (
              <View style={ui.emptyProducts}>
                <Text style={[ui.emptyHint, { color: c.textMuted }]}>
                  Impossible de charger les produits.
                </Text>
                <Pressable
                  onPress={() => void productsQ.refetch()}
                  style={ui.retryBtn}
                >
                  <Text style={[ui.retryText, { color: c.primary }]}>
                    Réessayer
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={ui.emptyProducts}>
                <Ionicons
                  name="storefront-outline"
                  size={36}
                  color={c.textMuted}
                />
                <Text style={[ui.emptyTitle, { color: c.text }]}>
                  Aucun produit
                </Text>
                <Text style={[ui.emptyHint, { color: c.textMuted }]}>
                  {debouncedQ || category
                    ? "Aucun résultat pour ce filtre."
                    : "Cette boutique n'a pas encore de produits."}
                </Text>
              </View>
            )
          }
          ListHeaderComponent={
            <>
              <View style={[ui.headerBlock, { borderBottomColor: HAIRLINE }]}>
                <View style={ui.brandRow}>
                  <ShopLiveAvatar
                    live={liveOn}
                    logoUrl={shop.logoUrl}
                    name={shop.name}
                    size={56}
                    onPress={openAvatar}
                  />
                  <View style={ui.brandCopy}>
                    <Text
                      style={[ui.name, { color: c.text }]}
                      numberOfLines={1}
                    >
                      {shop.name}
                    </Text>
                    <Text
                      style={[ui.meta, { color: c.textMuted }]}
                      numberOfLines={2}
                    >
                      @{shop.slug} · réf. {refCode} ·{" "}
                      {compactCount(productsCount)}{" "}
                      {productsCount > 1 ? "produits" : "produit"} ·{" "}
                      {compactCount(followers)}{" "}
                      {followers > 1 ? "abonnés" : "abonné"}
                    </Text>
                    {shop.description ? (
                      <Text
                        style={[ui.desc, { color: c.textMuted }]}
                        numberOfLines={2}
                      >
                        {shop.description}
                      </Text>
                    ) : null}
                    {hours ? (
                      <Text style={[ui.hours, { color: c.emerald }]}>
                        {hours}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={ui.actions}>
                  <Pressable
                    style={[
                      ui.followBtn,
                      {
                        backgroundColor: followed ? c.card : c.primary,
                        borderColor: followed ? HAIRLINE : c.primary,
                      },
                    ]}
                    onPress={() => void toggleFollow()}
                    disabled={followBusy}
                  >
                    <Text
                      style={[
                        ui.followText,
                        { color: followed ? c.text : c.primaryForeground },
                      ]}
                    >
                      {followed ? "Abonné" : "S'abonner"}
                    </Text>
                  </Pressable>

                  {shop.contactPhone ? (
                    <Pressable
                      style={[
                        ui.phoneBtn,
                        { borderColor: HAIRLINE, backgroundColor: c.card },
                      ]}
                      onPress={() => void openUrl(`tel:${shop.contactPhone}`)}
                    >
                      <Ionicons name="call" size={14} color={c.emerald} />
                      <Text
                        style={[ui.phoneText, { color: c.text }]}
                        numberOfLines={1}
                      >
                        {shop.contactPhone}
                      </Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    style={[
                      ui.iconBtn,
                      { borderColor: HAIRLINE, backgroundColor: c.card },
                    ]}
                    onPress={() => setShowAddress((v) => !v)}
                    accessibilityLabel="Voir l'adresse"
                  >
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color={c.text}
                    />
                  </Pressable>
                  <Pressable
                    style={[
                      ui.iconBtn,
                      { borderColor: HAIRLINE, backgroundColor: c.card },
                    ]}
                    onPress={() => void copyShopLink()}
                    accessibilityLabel="Copier le lien"
                  >
                    <Ionicons name="link-outline" size={18} color={c.text} />
                  </Pressable>
                  <Pressable
                    style={[
                      ui.iconBtn,
                      { borderColor: HAIRLINE, backgroundColor: c.card },
                    ]}
                    onPress={() => void shareShop()}
                    accessibilityLabel="Partager"
                  >
                    <Ionicons name="share-outline" size={18} color={c.text} />
                  </Pressable>
                  <Pressable
                    style={[
                      ui.iconBtn,
                      { backgroundColor: c.primary, borderColor: c.primary },
                    ]}
                    onPress={() => void messageSeller()}
                    accessibilityLabel="Message"
                  >
                    <Ionicons
                      name="chatbubble"
                      size={16}
                      color={c.primaryForeground}
                    />
                  </Pressable>
                </View>

                {shop.contactPhone ||
                shop.tiktokUrl ||
                shop.instagramUrl ||
                shop.facebookUrl ||
                shop.xUrl ? (
                  <View style={ui.socialRow}>
                    {shop.contactPhone ? (
                      <Pressable
                        style={[ui.socialBtn, { backgroundColor: "#25D366" }]}
                        onPress={() => void openWhatsApp(shop.contactPhone!)}
                        accessibilityLabel="WhatsApp"
                      >
                        <Ionicons name="logo-whatsapp" size={22} color="#fff" />
                      </Pressable>
                    ) : null}
                    {shop.tiktokUrl ? (
                      <Pressable
                        style={[ui.socialBtn, { backgroundColor: "#111" }]}
                        onPress={() => void openUrl(shop.tiktokUrl!)}
                        accessibilityLabel="TikTok"
                      >
                        <Ionicons name="logo-tiktok" size={20} color="#fff" />
                      </Pressable>
                    ) : null}
                    {shop.instagramUrl ? (
                      <Pressable
                        style={[ui.socialBtn, { backgroundColor: "#E1306C" }]}
                        onPress={() => void openUrl(shop.instagramUrl!)}
                        accessibilityLabel="Instagram"
                      >
                        <Ionicons
                          name="logo-instagram"
                          size={22}
                          color="#fff"
                        />
                      </Pressable>
                    ) : null}
                    {shop.facebookUrl ? (
                      <Pressable
                        style={[ui.socialBtn, { backgroundColor: "#1877F2" }]}
                        onPress={() => void openUrl(shop.facebookUrl!)}
                        accessibilityLabel="Facebook"
                      >
                        <Ionicons name="logo-facebook" size={22} color="#fff" />
                      </Pressable>
                    ) : null}
                    {shop.xUrl ? (
                      <Pressable
                        style={[ui.socialBtn, { backgroundColor: "#000" }]}
                        onPress={() => void openUrl(shop.xUrl!)}
                        accessibilityLabel="X"
                      >
                        <Ionicons name="logo-twitter" size={20} color="#fff" />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {showAddress ? (
                  <View
                    style={[
                      ui.addressCard,
                      { backgroundColor: c.card, borderColor: HAIRLINE },
                    ]}
                  >
                    <View style={ui.addressRow}>
                      <Ionicons name="location" size={16} color={c.primary} />
                      <Text style={[ui.addressText, { color: c.text }]}>
                        {shop.addressHint?.trim() || "Adresse non publiée"}
                      </Text>
                    </View>
                    {mapsUrl ? (
                      <Pressable onPress={() => void openUrl(mapsUrl)}>
                        <Text style={[ui.mapsLink, { color: c.primary }]}>
                          Ouvrir dans Maps
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                <View
                  style={[
                    ui.searchBox,
                    { backgroundColor: c.card, borderColor: HAIRLINE },
                  ]}
                >
                  <Ionicons name="search" size={18} color={c.textMuted} />
                  <TextInput
                    value={q}
                    onChangeText={setQ}
                    placeholder="Rechercher un produit..."
                    placeholderTextColor={c.textMuted}
                    style={[ui.searchInput, { color: c.text }]}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                  />
                  {q ? (
                    <Pressable onPress={() => setQ("")} hitSlop={8}>
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={c.textMuted}
                      />
                    </Pressable>
                  ) : null}
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={ui.chips}
                >
                  <Pressable
                    style={[
                      ui.chip,
                      !category
                        ? { backgroundColor: c.primary, borderColor: c.primary }
                        : { backgroundColor: c.card, borderColor: HAIRLINE },
                    ]}
                    onPress={() => setCategory(null)}
                  >
                    <Text
                      style={[
                        ui.chipText,
                        { color: !category ? c.primaryForeground : c.text },
                      ]}
                    >
                      Tout ({productsCount})
                    </Text>
                  </Pressable>
                  {categoryChips.map((chip) => {
                    const on = category === chip.id;
                    return (
                      <Pressable
                        key={chip.id}
                        style={[
                          ui.chip,
                          on
                            ? {
                                backgroundColor: c.primary,
                                borderColor: c.primary,
                              }
                            : {
                                backgroundColor: c.card,
                                borderColor: HAIRLINE,
                              },
                        ]}
                        onPress={() =>
                          setCategory((prev) =>
                            prev === chip.id ? null : chip.id,
                          )
                        }
                      >
                        <Text
                          style={[
                            ui.chipText,
                            { color: on ? c.primaryForeground : c.text },
                          ]}
                        >
                          {chip.label} ({chip.count})
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View
                onLayout={(event) => {
                  productsY.current = event.nativeEvent.layout.y;
                }}
                style={ui.productsBlock}
              />
            </>
          }
        />
      )}
    </View>
  );
}

const ui = StyleSheet.create({
  root: { flex: 1 },
  head: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  backText: { fontWeight: "700", fontSize: 16, marginLeft: 4 },
  empty: { textAlign: "center", marginTop: 40 },
  offlineState: { alignItems: "center", padding: 24, gap: 8 },
  retryBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  retryText: { fontSize: 13, fontWeight: "800" },
  headerBlock: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brandRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  brandCopy: { flex: 1, minWidth: 0, gap: 4 },
  name: { fontSize: 18, fontWeight: "800" },
  meta: { fontSize: 11, lineHeight: 15 },
  desc: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  hours: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  followBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 96,
  },
  followText: { fontSize: 13, fontWeight: "800" },
  phoneBtn: {
    height: 36,
    maxWidth: 160,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  phoneText: { fontSize: 12, fontWeight: "700", flexShrink: 1 },
  socialRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  socialBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  addressCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 8,
  },
  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  addressText: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  mapsLink: { fontSize: 12, fontWeight: "800" },
  searchBox: {
    height: 44,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    minHeight: 40,
  },
  chips: { gap: 8, paddingRight: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 12, fontWeight: "700" },
  productsBlock: { paddingHorizontal: 16, paddingTop: 16 },
  emptyProducts: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800" },
  emptyHint: { fontSize: 13, textAlign: "center" },
  gridRow: { gap: 10, paddingHorizontal: 16 },
  card: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  catBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  catBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
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
