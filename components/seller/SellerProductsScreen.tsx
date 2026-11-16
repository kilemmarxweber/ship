import { safeBack } from "@/src/nav";
import { Ionicons } from "@expo/vector-icons";
import {
    useInfiniteQuery,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    ShopPicker,
    type ShopPickerShop,
} from "@/components/profile/ShopPicker";
import { MediaStrip } from "@/components/publish/MediaStrip";
import { ShipRewardsCard } from "@/components/seller/ShipRewardsCard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SheetReduce } from "@/components/ui/SheetReduce";
import { api, mediaUrl } from "@/src/api";
import { formatMoney } from "@/src/format";
import { coverOf } from "@/src/media";
import {
    APP_CURRENCIES,
    priceToCents,
    sanitizePriceInput,
    type AppCurrency,
} from "@/src/product-options";
import { useSession } from "@/src/session";
import { HAIRLINE } from "@/src/theme";
import { showToast } from "@/src/toast";
import type { Product } from "@/src/types";
import { useColors } from "@/src/use-colors";

type Tab = "all" | "ACTIVE" | "DRAFT" | "HIDDEN" | "SOLD";

type SellerProduct = Product & {
  location?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Publié",
  DRAFT: "Brouillon",
  HIDDEN: "Archivé",
  SOLD: "Épuisé",
};

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "ACTIVE", label: "Publiés" },
  { key: "DRAFT", label: "Brouillons" },
  { key: "HIDDEN", label: "Archivés" },
  { key: "SOLD", label: "Épuisés" },
];

function parseCurrency(value?: string): AppCurrency {
  return APP_CURRENCIES.includes(value as AppCurrency)
    ? (value as AppCurrency)
    : "USD";
}

export function SellerProductsScreen() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ shopId?: string }>();
  const [shopId, setShopId] = useState(
    typeof params.shopId === "string" ? params.shopId : "",
  );
  const [tab, setTab] = useState<Tab>("all");
  const [editing, setEditing] = useState<SellerProduct | null>(null);
  const [priceText, setPriceText] = useState("");
  const [qtyText, setQtyText] = useState("0");
  const [busy, setBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [republishOpen, setRepublishOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<SellerProduct | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const shopsQ = useQuery({
    queryKey: ["seller-shops", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () =>
      api<{ shops?: ShopPickerShop[]; isPlatformOwner?: boolean }>(
        "/api/shops?mine=1",
      ),
  });
  const shops = shopsQ.data?.shops ?? [];
  const platform = Boolean(shopsQ.data?.isPlatformOwner);

  const list = useInfiniteQuery({
    queryKey: ["seller-products", token ?? "guest", shopId, tab],
    enabled: Boolean(token),
    initialPageParam: "",
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ mine: "1", limit: "24" });
      if (shopId) params.set("shopId", shopId);
      if (tab !== "all") params.set("status", tab);
      if (pageParam) params.set("cursor", String(pageParam));
      return api<{ products?: SellerProduct[]; nextCursor?: string | null }>(
        `/api/products?${params}`,
      );
    },
    getNextPageParam: (last) => last.nextCursor || undefined,
  });
  const products = useMemo(
    () => list.data?.pages.flatMap((page) => page.products ?? []) ?? [],
    [list.data?.pages],
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["seller-products"] });
  }

  function openEdit(p: SellerProduct) {
    setEditing({ ...p });
    setPriceText(p.priceCents ? (p.priceCents / 100).toString() : "");
    setQtyText(String(p.quantity ?? 0));
  }

  async function save() {
    if (!editing) return;
    if (editing.images.length === 0) {
      showToast("Ajoutez au moins une image ou une vidéo", "error");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/products/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editing.title,
          description: editing.description,
          priceCents: priceToCents(priceText),
          currency: parseCurrency(editing.currency),
          quantity: parseInt(qtyText || "0", 10) || 0,
          category: editing.category,
          images: editing.images,
          location: editing.location ?? null,
          status: editing.status,
        }),
      });
      showToast("Produit mis à jour", "success");
      setEditing(null);
      await refresh();
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "Échec", "error");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setBusy(true);
    try {
      await api(`/api/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      showToast(
        status === "ACTIVE"
          ? "Produit publié"
          : status === "HIDDEN"
            ? "Produit archivé"
            : status === "DRAFT"
              ? "Remis en brouillon"
              : "Statut mis à jour",
        "success",
      );
      await refresh();
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "Échec", "error");
    } finally {
      setBusy(false);
    }
  }

  function remove(p: SellerProduct) {
    if (!p.canDelete) {
      showToast(
        "Lié à un paiement — archivez-le plutôt que de le supprimer",
        "error",
      );
      return;
    }
    setPendingDelete(p);
  }

  async function confirmRemoveProduct() {
    const p = pendingDelete;
    if (!p) return;
    setDeleting(true);
    setBusy(true);
    try {
      await api(`/api/products/${p.id}`, { method: "DELETE" });
      showToast("Produit supprimé", "success");
      setPendingDelete(null);
      await refresh();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Suppression impossible",
        "error",
      );
    } finally {
      setDeleting(false);
      setBusy(false);
    }
  }

  function openRepublish() {
    if (products.length === 0) {
      showToast("Aucun produit à republier", "info");
      return;
    }
    setSelectedIds(new Set());
    setRepublishOpen(true);
  }

  function toggleRepublishProduct(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllRepublish() {
    setSelectedIds((prev) => {
      if (prev.size === products.length) return new Set();
      return new Set(products.map((p) => p.id));
    });
  }

  async function confirmRepublish() {
    if (selectedIds.size === 0) {
      showToast("Sélectionnez au moins un produit", "error");
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ updated?: number }>("/api/products", {
        method: "PATCH",
        body: JSON.stringify({
          action: "activate_products",
          productIds: Array.from(selectedIds),
        }),
      });
      showToast(
        data.updated != null
          ? `${data.updated} produit(s) republié(s)`
          : "Produits republiés",
        "success",
      );
      setRepublishOpen(false);
      await refresh();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Republication impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  function changeCurrency(next: AppCurrency) {
    if (!editing) return;
    const prev = parseCurrency(editing.currency);
    if (next === prev) return;
    const apply = () =>
      setEditing({ ...editing, currency: next, priceCents: 0 });
    if (editing.priceCents > 0) {
      Alert.alert(
        "Changer la monnaie ?",
        "Changer de monnaie vide le prix. Continuer ?",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Continuer",
            onPress: () => {
              apply();
              setPriceText("");
            },
          },
        ],
      );
      return;
    }
    apply();
  }

  const statusColor = (status?: string) => {
    if (status === "ACTIVE") return c.emerald;
    if (status === "DRAFT") return "#FBBF24";
    return c.textMuted;
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityLabel="Retour" onPress={() => safeBack()} style={styles.back}>
          <Ionicons name="chevron-back" size={20} color={c.text} />
          
        </Pressable>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: c.text }]}>
              {platform ? "Produits boutiques" : "Mes produits"}
            </Text>
            <Text style={[styles.sub, { color: c.textMuted }]}>
              Modifier · publier · archiver · supprimer
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={openRepublish}
            disabled={busy || products.length === 0}
            style={[
              styles.ghostBtn,
              {
                borderColor: HAIRLINE,
                opacity: products.length === 0 ? 0.45 : 1,
              },
            ]}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={16}
              color={c.text}
            />
            <Text style={[styles.ghostText, { color: c.text }]}>Republier</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              router.push(
                shopId
                  ? `/publish?mode=sell&shopId=${shopId}`
                  : "/publish?mode=sell",
              )
            }
            style={[styles.add, { backgroundColor: c.primary }]}
          >
            <Ionicons name="add" size={16} color={c.primaryForeground} />
            <Text style={[styles.addText, { color: c.primaryForeground }]}>
              Créer
            </Text>
          </Pressable>
        </View>
      </View>

      {!token ? (
        <View style={styles.center}>
          <Pressable
            style={[styles.add, { backgroundColor: c.primary }]}
            onPress={openAuth}
          >
            <Text style={[styles.addText, { color: c.primaryForeground }]}>
              Se connecter
            </Text>
          </Pressable>
        </View>
      ) : list.isLoading && products.length === 0 ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) {
              void list.fetchNextPage();
            }
          }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 24,
            gap: 12,
          }}
          ListHeaderComponent={
            <View style={{ gap: 12, marginBottom: 12 }}>
              <ShopPicker
                shops={shops}
                value={shopId}
                allLabel="Toutes les boutiques"
                onChange={setShopId}
              />
              {shopId ? <ShipRewardsCard shopId={shopId} /> : null}
              <View style={styles.tabs}>
                {TABS.map((item) => {
                  const on = tab === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => setTab(item.key)}
                      style={[
                        styles.tab,
                        on
                          ? { backgroundColor: c.primary }
                          : { backgroundColor: "rgba(127,127,140,0.14)" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          { color: on ? c.primaryForeground : c.textMuted },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={{ paddingVertical: 32, alignItems: "center", gap: 8 }}>
              <Text style={{ color: c.textMuted, textAlign: "center" }}>
                {list.isError
                  ? "Impossible de charger les produits"
                  : "Aucun produit —"}
              </Text>
              {list.isError ? (
                <Pressable onPress={() => void list.refetch()}>
                  <Text style={{ color: c.primary, fontWeight: "800" }}>
                    Réessayer
                  </Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => router.push("/publish")}>
                  <Text style={{ color: c.primary, fontWeight: "800" }}>
                    créer
                  </Text>
                </Pressable>
              )}
            </View>
          }
          ListFooterComponent={
            list.isFetchingNextPage ? (
              <ActivityIndicator
                color={c.primary}
                style={{ marginVertical: 16 }}
              />
            ) : undefined
          }
          renderItem={({ item }) => {
            const cover = mediaUrl(coverOf(item.images));
            return (
              <View
                key={item.id}
                style={[
                  styles.row,
                  { backgroundColor: c.card, borderColor: HAIRLINE },
                ]}
              >
                <View style={styles.rowTop}>
                  {cover ? (
                    <Image
                      source={{ uri: cover }}
                      style={styles.thumb}
                      contentFit="cover"
                      recyclingKey={item.id}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View style={[styles.thumb, { backgroundColor: "#222" }]} />
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={[styles.name, { color: c.text }]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text style={{ color: c.textMuted, fontSize: 12 }}>
                      {formatMoney(item.priceCents, item.currency)} · stock{" "}
                      {item.quantity ?? 0} ·{" "}
                      <Text
                        style={{
                          color: statusColor(item.status),
                          fontWeight: "800",
                        }}
                      >
                        {STATUS_LABEL[item.status ?? "ACTIVE"] ?? item.status}
                      </Text>
                      {(item.ordersCount ?? 0) > 0
                        ? ` · ${item.ordersCount} vente(s)`
                        : ""}
                    </Text>
                    <Text style={{ color: c.textMuted, fontSize: 11 }}>
                      @{item.shop.name}
                    </Text>
                  </View>
                </View>

                <View style={styles.btnRow}>
                  <Pressable
                    disabled={busy}
                    onPress={() => openEdit(item)}
                    style={[
                      styles.chip,
                      { backgroundColor: "rgba(127,127,140,0.14)" },
                    ]}
                  >
                    <Ionicons name="pencil" size={13} color={c.text} />
                    <Text style={[styles.chipText, { color: c.text }]}>
                      Modifier
                    </Text>
                  </Pressable>

                  {item.status === "DRAFT" ? (
                    <Pressable
                      disabled={busy}
                      onPress={() => void setStatus(item.id, "ACTIVE")}
                      style={[styles.chip, { backgroundColor: c.primary }]}
                    >
                      <Ionicons
                        name="eye-outline"
                        size={13}
                        color={c.primaryForeground}
                      />
                      <Text
                        style={[
                          styles.chipText,
                          { color: c.primaryForeground },
                        ]}
                      >
                        Publier
                      </Text>
                    </Pressable>
                  ) : null}

                  {item.status === "ACTIVE" ? (
                    <Pressable
                      disabled={busy}
                      onPress={() => void setStatus(item.id, "HIDDEN")}
                      style={[
                        styles.chip,
                        { borderColor: HAIRLINE, borderWidth: 1 },
                      ]}
                    >
                      <Ionicons
                        name="archive-outline"
                        size={13}
                        color={c.text}
                      />
                      <Text style={[styles.chipText, { color: c.text }]}>
                        Archiver
                      </Text>
                    </Pressable>
                  ) : null}

                  {item.status === "HIDDEN" ? (
                    <Pressable
                      disabled={busy}
                      onPress={() => void setStatus(item.id, "ACTIVE")}
                      style={[styles.chip, { backgroundColor: c.primary }]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: c.primaryForeground },
                        ]}
                      >
                        Republier
                      </Text>
                    </Pressable>
                  ) : null}

                  {item.status === "SOLD" && (item.quantity ?? 0) > 0 ? (
                    <Pressable
                      disabled={busy}
                      onPress={() => void setStatus(item.id, "ACTIVE")}
                      style={[styles.chip, { backgroundColor: c.primary }]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: c.primaryForeground },
                        ]}
                      >
                        Remettre en vente
                      </Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    disabled={busy || !item.canDelete}
                    onPress={() => remove(item)}
                    style={[
                      styles.chip,
                      {
                        borderWidth: 1,
                        borderColor: item.canDelete
                          ? "rgba(255,69,58,0.45)"
                          : HAIRLINE,
                        opacity: item.canDelete ? 1 : 0.45,
                      },
                    ]}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={13}
                      color={item.canDelete ? "#FF453A" : c.textMuted}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        { color: item.canDelete ? "#FF453A" : c.textMuted },
                      ]}
                    >
                      Supprimer
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}

      <Modal
        visible={Boolean(editing)}
        animationType="slide"
        transparent
        onRequestClose={() => setEditing(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <Pressable style={styles.dim} onPress={() => setEditing(null)} />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: c.sheet,
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            <SheetReduce onPress={() => setEditing(null)} />
            <Text style={[styles.sheetTitle, { color: c.text }]}>Éditer</Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 12, paddingBottom: 12 }}
            >
              <Text style={[styles.label, { color: c.textMuted }]}>Titre</Text>
              <TextInput
                value={editing?.title ?? ""}
                onChangeText={(title) =>
                  setEditing((prev) => (prev ? { ...prev, title } : prev))
                }
                style={[
                  styles.input,
                  { color: c.text, backgroundColor: "rgba(127,127,140,0.12)" },
                ]}
              />
              <Text style={[styles.label, { color: c.textMuted }]}>
                Monnaie
              </Text>
              <View style={styles.tabs}>
                {APP_CURRENCIES.map((code) => {
                  const on = parseCurrency(editing?.currency) === code;
                  return (
                    <Pressable
                      key={code}
                      onPress={() => changeCurrency(code)}
                      style={[
                        styles.tab,
                        on
                          ? { backgroundColor: c.primary }
                          : { backgroundColor: "rgba(127,127,140,0.14)" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          { color: on ? c.primaryForeground : c.textMuted },
                        ]}
                      >
                        {code}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.split}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[styles.label, { color: c.textMuted }]}>
                    Prix ({editing?.currency ?? "USD"})
                  </Text>
                  <TextInput
                    keyboardType="decimal-pad"
                    value={priceText}
                    onChangeText={(raw) =>
                      setPriceText(sanitizePriceInput(raw))
                    }
                    style={[
                      styles.input,
                      {
                        color: c.text,
                        backgroundColor: "rgba(127,127,140,0.12)",
                      },
                    ]}
                  />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[styles.label, { color: c.textMuted }]}>
                    Quantité
                  </Text>
                  <TextInput
                    keyboardType="number-pad"
                    value={qtyText}
                    onChangeText={setQtyText}
                    style={[
                      styles.input,
                      {
                        color: c.text,
                        backgroundColor: "rgba(127,127,140,0.12)",
                      },
                    ]}
                  />
                </View>
              </View>
              <Text style={[styles.label, { color: c.textMuted }]}>Statut</Text>
              <View style={styles.tabs}>
                {(
                  [
                    ["DRAFT", "Brouillon"],
                    ["ACTIVE", "Publié"],
                    ["HIDDEN", "Archivé"],
                    ["SOLD", "Épuisé"],
                  ] as const
                ).map(([key, label]) => {
                  const on = editing?.status === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() =>
                        setEditing((prev) =>
                          prev ? { ...prev, status: key } : prev,
                        )
                      }
                      style={[
                        styles.tab,
                        on
                          ? { backgroundColor: c.primary }
                          : { backgroundColor: "rgba(127,127,140,0.14)" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          { color: on ? c.primaryForeground : c.textMuted },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.label, { color: c.textMuted }]}>
                Description
              </Text>
              <TextInput
                multiline
                value={editing?.description ?? ""}
                onChangeText={(description) =>
                  setEditing((prev) => (prev ? { ...prev, description } : prev))
                }
                style={[
                  styles.input,
                  styles.area,
                  { color: c.text, backgroundColor: "rgba(127,127,140,0.12)" },
                ]}
              />
              <Text style={[styles.label, { color: c.textMuted }]}>Médias</Text>
              {editing ? (
                <MediaStrip
                  urls={editing.images}
                  onChange={(images) =>
                    setEditing((prev) => (prev ? { ...prev, images } : prev))
                  }
                  busy={mediaBusy}
                  setBusy={setMediaBusy}
                  category={editing.category ?? "divers"}
                />
              ) : null}
            </ScrollView>
            <View style={styles.split}>
              <Pressable
                onPress={() => setEditing(null)}
                style={[styles.ghostBtn, { flex: 1, borderColor: HAIRLINE }]}
              >
                <Text style={[styles.ghostText, { color: c.text }]}>
                  Annuler
                </Text>
              </Pressable>
              <Pressable
                disabled={busy || mediaBusy}
                onPress={() => void save()}
                style={[
                  styles.add,
                  {
                    flex: 2,
                    backgroundColor: c.primary,
                    justifyContent: "center",
                  },
                ]}
              >
                <Text style={[styles.addText, { color: c.primaryForeground }]}>
                  {busy ? "…" : "Enregistrer"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={republishOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setRepublishOpen(false)}
      >
        <View style={styles.modalWrap}>
          <Pressable
            style={styles.dim}
            onPress={() => setRepublishOpen(false)}
          />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: c.sheet,
                paddingBottom: insets.bottom + 16,
                maxHeight: "80%",
              },
            ]}
          >
            <SheetReduce onPress={() => setRepublishOpen(false)} />
            <Text style={[styles.sheetTitle, { color: c.text }]}>
              Republier des produits
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 13, marginBottom: 8 }}>
              Tous vos produits — cochez 1 ou plusieurs à republier
            </Text>
            <Pressable onPress={toggleAllRepublish} hitSlop={8}>
              <Text
                style={{ color: c.primary, fontWeight: "700", fontSize: 12 }}
              >
                {selectedIds.size === products.length
                  ? "Tout désélectionner"
                  : "Tout sélectionner"}
              </Text>
            </Pressable>
            <ScrollView style={{ maxHeight: 360, marginTop: 8 }}>
              {products.map((p) => {
                const checked = selectedIds.has(p.id);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => toggleRepublishProduct(p.id)}
                    style={[
                      styles.pickRow,
                      {
                        borderColor: checked ? `${c.primary}80` : HAIRLINE,
                        backgroundColor: checked
                          ? `${c.primary}12`
                          : "transparent",
                      },
                    ]}
                  >
                    <Ionicons
                      name={checked ? "checkbox" : "square-outline"}
                      size={20}
                      color={checked ? c.primary : c.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.name, { color: c.text }]}
                        numberOfLines={1}
                      >
                        {p.title}
                      </Text>
                      <Text style={{ color: c.textMuted, fontSize: 11 }}>
                        {formatMoney(p.priceCents, p.currency)} ·{" "}
                        {STATUS_LABEL[p.status ?? "ACTIVE"] ?? p.status}
                        {p.shop?.name ? ` · @${p.shop.name}` : ""}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={[styles.split, { marginTop: 12 }]}>
              <Pressable
                disabled={busy}
                onPress={() => setRepublishOpen(false)}
                style={[styles.ghostBtn, { flex: 1, borderColor: HAIRLINE }]}
              >
                <Text style={[styles.ghostText, { color: c.text }]}>
                  Annuler
                </Text>
              </Pressable>
              <Pressable
                disabled={busy || selectedIds.size === 0}
                onPress={() => void confirmRepublish()}
                style={[
                  styles.add,
                  {
                    flex: 1,
                    backgroundColor: c.primary,
                    justifyContent: "center",
                    opacity: selectedIds.size === 0 ? 0.45 : 1,
                  },
                ]}
              >
                <Text style={[styles.addText, { color: c.primaryForeground }]}>
                  Republier ({selectedIds.size})
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Supprimer le produit ?"
        message={
          pendingDelete
            ? `Supprimer définitivement « ${pendingDelete.title} » ? Cette action est irréversible.`
            : undefined
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        destructive
        busy={deleting}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={() => void confirmRemoveProduct()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 16,
    overflow: "visible",
    minWidth: 44,
    minHeight: 44,

  },
  titleRow: { flexDirection: "row", alignItems: "flex-start" },
  title: { fontSize: 26, fontWeight: "800" },
  sub: { fontSize: 12, marginTop: 2 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  add: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
  },
  addText: { fontWeight: "800" },
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
  },
  ghostText: { fontWeight: "700", fontSize: 13 },
  center: { padding: 24 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tab: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: "center",
  },
  tabText: { fontSize: 11, fontWeight: "700" },
  row: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  rowTop: { flexDirection: "row", gap: 10 },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  name: { fontWeight: "800" },
  btnRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 36,
  },
  chipText: { fontSize: 12, fontWeight: "700" },
  modalWrap: { flex: 1, justifyContent: "flex-end" },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: "92%",
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "700" },
  input: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  area: { minHeight: 80, textAlignVertical: "top" },
  split: { flexDirection: "row", gap: 8 },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
});
