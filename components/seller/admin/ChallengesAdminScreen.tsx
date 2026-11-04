import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MediaStrip } from "@/components/publish/MediaStrip";
import {
    AdminProductPicker,
    type AdminProductHit,
} from "@/components/seller/admin/AdminProductPicker";
import { PagedMore } from "@/components/ui/PagedMore";
import { api, mediaUrl } from "@/src/api";
import { useT } from "@/src/i18n";
import { priceToCents, sanitizePriceInput } from "@/src/product-options";
import { useSession } from "@/src/session";
import { categories, HAIRLINE } from "@/src/theme";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";
import { usePaged } from "@/src/use-paged";

type Focus = "none" | "catalog" | "teaser";

type ChallengeRow = {
  id: string;
  title: string;
  body: string;
  category: string | null;
  city: string | null;
  startsAt: string;
  endsAt: string;
  completions: number;
  productFocus?: Focus | string | null;
  productId?: string | null;
  productTeaser?: {
    title?: string;
    image?: string | null;
    priceCents?: number | null;
    currency?: string | null;
    shopName?: string | null;
    note?: string | null;
  } | null;
  product?: {
    id: string;
    title: string;
    description: string | null;
    images: string[];
    priceCents: number;
    currency: string;
    category: string;
    shop: { name: string };
  } | null;
};

type CatalogItem = { title: string; body: string; category: string };

const FOCUS_OPTIONS: { id: Focus; label: string; hint: string }[] = [
  {
    id: "none",
    label: "Mission libre",
    hint: "Engagement catégorie / ville — sans produit",
  },
  {
    id: "catalog",
    label: "Produit boutique",
    hint: "Lien vers une fiche publiée (achat)",
  },
  {
    id: "teaser",
    label: "Hors catalogue",
    hint: "Produit pas encore enregistré — aperçu",
  },
];

function focusOf(row: ChallengeRow): Focus {
  if (row.productFocus === "catalog" || row.product) return "catalog";
  if (row.productFocus === "teaser" || row.productTeaser?.title)
    return "teaser";
  return "none";
}

export function ChallengesAdminScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("Mode");
  const [city, setCity] = useState("Kinshasa");
  const [hours, setHours] = useState("24");
  const [focus, setFocus] = useState<Focus>("none");
  const [product, setProduct] = useState<AdminProductHit | null>(null);
  const [teaserTitle, setTeaserTitle] = useState("");
  const [teaserShop, setTeaserShop] = useState("");
  const [teaserPrice, setTeaserPrice] = useState("");
  const [teaserNote, setTeaserNote] = useState("");
  const [teaserImage, setTeaserImage] = useState<string[]>([]);
  const [spotlight, setSpotlight] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);

  const q = useQuery({
    queryKey: ["admin-challenges", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () =>
      api<{
        active?: ChallengeRow[];
        recent?: ChallengeRow[];
        catalog?: CatalogItem[];
      }>("/api/admin/challenges"),
    retry: false,
  });

  const active = q.data?.active ?? [];
  const recent = q.data?.recent ?? [];
  const catalog = q.data?.catalog ?? [];
  const pagedActive = usePaged(active, `a-${active.length}`);
  const pagedRecent = usePaged(recent, `r-${recent.length}`);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setBody("");
    setCategory("Mode");
    setCity("Kinshasa");
    setHours("24");
    setFocus("none");
    setProduct(null);
    setTeaserTitle("");
    setTeaserShop("");
    setTeaserPrice("");
    setTeaserNote("");
    setTeaserImage([]);
    setSpotlight([]);
  }

  function startEdit(row: ChallengeRow) {
    setEditingId(row.id);
    setTitle(row.title);
    setBody(row.body);
    setCategory((row.category as (typeof categories)[number]) || "Mode");
    setCity(row.city || "Kinshasa");
    setHours("24");
    const f = focusOf(row);
    setFocus(f);
    if (f === "catalog" && row.product) {
      setProduct({
        id: row.product.id,
        title: row.product.title,
        description: row.product.description,
        images: row.product.images,
        priceCents: row.product.priceCents,
        currency: row.product.currency,
        category: row.product.category,
        shop: row.product.shop,
      });
    } else setProduct(null);
    setTeaserTitle(row.productTeaser?.title ?? "");
    setTeaserShop(row.productTeaser?.shopName ?? "");
    setTeaserPrice(
      row.productTeaser?.priceCents
        ? String(row.productTeaser.priceCents / 100)
        : "",
    );
    setTeaserNote(row.productTeaser?.note ?? "");
    setTeaserImage(row.productTeaser?.image ? [row.productTeaser.image] : []);
  }

  function fillFromCatalog(item: CatalogItem) {
    setTitle(item.title);
    setBody(item.body);
    setCategory((item.category as (typeof categories)[number]) || "Mode");
    setFocus("none");
    setProduct(null);
  }

  async function saveChallenge() {
    if (focus === "catalog" && !product) {
      showToast("Choisissez un produit publié", "error");
      return;
    }
    if (focus === "teaser" && teaserTitle.trim().length < 2) {
      showToast("Nom du produit (hors catalogue) requis", "error");
      return;
    }
    if (!title.trim() && focus === "none") {
      showToast("Titre requis pour une mission libre", "error");
      return;
    }
    if (!body.trim() && focus === "none") {
      showToast("Consigne requise pour une mission libre", "error");
      return;
    }

    const focusPayload =
      focus === "catalog"
        ? {
            productFocus: "catalog",
            productId: product?.id ?? null,
            productTeaser: null,
          }
        : focus === "teaser"
          ? {
              productFocus: "teaser",
              productId: null,
              productTeaser: {
                title: teaserTitle.trim(),
                image: teaserImage[0] || null,
                priceCents:
                  priceToCents(sanitizePriceInput(teaserPrice)) || null,
                currency: "USD",
                shopName: teaserShop.trim() || null,
                note: teaserNote.trim() || null,
              },
            }
          : {
              productFocus: "none",
              productId: null,
              productTeaser: null,
            };

    const spotlightPayload = spotlight[0]
      ? {
          spotlight: {
            url: spotlight[0],
            kind: /\.(mp4|webm|mov)(\?|$)/i.test(spotlight[0])
              ? "video"
              : "image",
          },
        }
      : { spotlight: null };

    setBusy(true);
    try {
      if (editingId) {
        await api("/api/admin/challenges", {
          method: "PATCH",
          body: JSON.stringify({
            id: editingId,
            title: title.trim() || undefined,
            body: body.trim() || undefined,
            category,
            city: city.trim() || "Kinshasa",
            ...focusPayload,
            ...spotlightPayload,
          }),
        });
        showToast("Challenge mis à jour", "success");
      } else {
        await api("/api/admin/challenges", {
          method: "POST",
          body: JSON.stringify({
            title: title.trim() || undefined,
            body: body.trim() || undefined,
            category,
            city: city.trim() || "Kinshasa",
            hours: Number.parseInt(hours, 10) || 24,
            ...focusPayload,
            ...spotlightPayload,
          }),
        });
        showToast("Challenge publié — sync feed / Découvrir", "success");
      }
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ["admin-challenges"] });
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Enregistrement impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function patchChallenge(
    bodyJson: Record<string, unknown>,
    okMsg: string,
  ) {
    try {
      await api("/api/admin/challenges", {
        method: "PATCH",
        body: JSON.stringify(bodyJson),
      });
      showToast(okMsg, "success");
      await queryClient.invalidateQueries({ queryKey: ["admin-challenges"] });
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Action impossible",
        "error",
      );
    }
  }

  async function seedCatalog() {
    setBusy(true);
    try {
      await api("/api/admin/challenges", {
        method: "POST",
        body: JSON.stringify({ action: "seed_catalog" }),
      });
      showToast("Catalogue du jour synchronisé", "success");
      await queryClient.invalidateQueries({ queryKey: ["admin-challenges"] });
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Seed impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  function removeChallenge(id: string) {
    Alert.alert("Supprimer définitivement ce challenge ?", undefined, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await api(`/api/admin/challenges?id=${encodeURIComponent(id)}`, {
                method: "DELETE",
              });
              showToast("Challenge supprimé", "success");
              if (editingId === id) resetForm();
              await queryClient.invalidateQueries({
                queryKey: ["admin-challenges"],
              });
            } catch (cause) {
              showToast(
                cause instanceof Error
                  ? cause.message
                  : "Suppression impossible",
                "error",
              );
            }
          })();
        },
      },
    ]);
  }

  function renderRow(row: ChallengeRow, ended = false) {
    const cover =
      mediaUrl(row.product?.images[0]) ||
      mediaUrl(row.productTeaser?.image) ||
      null;
    return (
      <View
        key={row.id}
        style={[
          styles.card,
          { backgroundColor: c.card, borderColor: HAIRLINE },
        ]}
      >
        <View style={{ flexDirection: "row", gap: 10 }}>
          {cover ? (
            <Image
              source={{ uri: cover }}
              style={styles.thumb}
              contentFit="cover"
            />
          ) : (
            <View
              style={[
                styles.thumb,
                { backgroundColor: "rgba(127,127,140,0.2)" },
              ]}
            />
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{ color: c.text, fontWeight: "800" }}
              numberOfLines={2}
            >
              {row.title}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 11 }}>
              {row.category ?? "—"} · {row.city ?? "Kinshasa"} ·{" "}
              {row.completions} complétions
            </Text>
            <Text style={{ color: c.primary, fontSize: 11, fontWeight: "700" }}>
              {focusOf(row) === "catalog" && row.product
                ? `Boutique · ${row.product.title}`
                : focusOf(row) === "teaser"
                  ? `Aperçu · ${row.productTeaser?.title ?? ""}`
                  : "Mission libre"}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={() => startEdit(row)}
            style={[styles.chip, { borderColor: HAIRLINE }]}
          >
            <Text style={{ color: c.text, fontWeight: "700", fontSize: 11 }}>
              Modifier
            </Text>
          </Pressable>
          {!ended ? (
            <>
              <Pressable
                onPress={() =>
                  void patchChallenge(
                    { id: row.id, hours: 24 },
                    "+24 h — remis en avant",
                  )
                }
                style={[
                  styles.chip,
                  { backgroundColor: "rgba(127,127,140,0.14)" },
                ]}
              >
                <Text
                  style={{ color: c.text, fontWeight: "700", fontSize: 11 }}
                >
                  +24 h
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  void patchChallenge(
                    { id: row.id, endNow: true },
                    "Challenge terminé",
                  )
                }
                style={[styles.chip, { borderColor: "rgba(255,69,58,0.4)" }]}
              >
                <Text
                  style={{ color: "#FF453A", fontWeight: "700", fontSize: 11 }}
                >
                  Terminer
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() =>
                void patchChallenge(
                  { id: row.id, reactivate: true, hours: 24 },
                  "Challenge réactivé (+24 h)",
                )
              }
              style={[styles.chip, { backgroundColor: c.primary }]}
            >
              <Text
                style={{
                  color: c.primaryForeground,
                  fontWeight: "700",
                  fontSize: 11,
                }}
              >
                Réactiver
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => removeChallenge(row.id)}
            style={[styles.chip, { borderColor: HAIRLINE }]}
          >
            <Text
              style={{ color: c.textMuted, fontWeight: "700", fontSize: 11 }}
            >
              Supprimer
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.wrap, { backgroundColor: c.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 16,
        gap: 12,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Ionicons name="chevron-back" size={20} color={c.text} />
        <Text style={[styles.backText, { color: c.text }]} numberOfLines={1}>
          {t("back")}
          {"\u00A0"}
        </Text>
      </Pressable>
      <View>
        <Text style={[styles.title, { color: c.text }]}>Challenges</Text>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          Missions feed / Découvrir — produit boutique, aperçu ou libre.
        </Text>
      </View>

      {!token ? (
        <Pressable
          style={[styles.primary, { backgroundColor: c.primary }]}
          onPress={openAuth}
        >
          <Text style={[styles.primaryText, { color: c.primaryForeground }]}>
            Se connecter
          </Text>
        </Pressable>
      ) : q.isLoading ? (
        <ActivityIndicator color={c.primary} />
      ) : q.isError ? (
        <Text
          style={{
            color: c.textMuted,
            textAlign: "center",
            paddingVertical: 24,
          }}
        >
          Réservé à l’owner ShipShop.
        </Text>
      ) : (
        <>
          <View
            style={[
              styles.card,
              { backgroundColor: c.card, borderColor: HAIRLINE },
            ]}
          >
            <Text style={[styles.section, { color: c.text }]}>
              {editingId ? "Modifier le challenge" : "Nouveau challenge"}
            </Text>
            {catalog.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {catalog.slice(0, 8).map((item) => (
                    <Pressable
                      key={`${item.title}-${item.category}`}
                      onPress={() => fillFromCatalog(item)}
                      style={[styles.chip, { borderColor: HAIRLINE }]}
                    >
                      <Text
                        style={{ color: c.textMuted, fontSize: 11 }}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            ) : null}
            <Pressable
              disabled={busy}
              onPress={() => void seedCatalog()}
              style={[
                styles.chip,
                { alignSelf: "flex-start", borderColor: HAIRLINE },
              ]}
            >
              <Text
                style={{ color: c.primary, fontWeight: "700", fontSize: 12 }}
              >
                Sync catalogue du jour
              </Text>
            </Pressable>

            <Text style={[styles.label, { color: c.textMuted }]}>Ancrage</Text>
            <View style={styles.actions}>
              {FOCUS_OPTIONS.map((opt) => {
                const on = focus === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => {
                      setFocus(opt.id);
                      if (opt.id !== "catalog") setProduct(null);
                    }}
                    style={[
                      styles.focusBtn,
                      on
                        ? { backgroundColor: c.primary }
                        : { backgroundColor: "rgba(127,127,140,0.14)" },
                    ]}
                  >
                    <Text
                      style={{
                        color: on ? c.primaryForeground : c.textMuted,
                        fontWeight: "800",
                        fontSize: 11,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: c.textMuted, fontSize: 11 }}>
              {FOCUS_OPTIONS.find((o) => o.id === focus)?.hint}
            </Text>

            {focus === "catalog" ? (
              <AdminProductPicker
                selected={product}
                onSelect={(p) => {
                  setProduct(p);
                  if (!title.trim())
                    setTitle(`Challenge · ${p.title}`.slice(0, 120));
                  if (!body.trim()) {
                    const desc = (p.description ?? "").trim();
                    setBody(
                      desc
                        ? `Découvre « ${p.title} » — ${desc.slice(0, 220)}`.slice(
                            0,
                            400,
                          )
                        : `Découvre « ${p.title} », like et commente ton avis.`,
                    );
                  }
                  if (p.category && categories.includes(p.category as never)) {
                    setCategory(p.category as (typeof categories)[number]);
                  }
                }}
                onClear={() => setProduct(null)}
              />
            ) : null}

            {focus === "teaser" ? (
              <View style={{ gap: 8 }}>
                <TextInput
                  value={teaserTitle}
                  onChangeText={setTeaserTitle}
                  placeholder="Nom produit hors catalogue"
                  placeholderTextColor={c.textMuted}
                  style={[
                    styles.input,
                    {
                      color: c.text,
                      backgroundColor: "rgba(127,127,140,0.12)",
                    },
                  ]}
                />
                <TextInput
                  value={teaserShop}
                  onChangeText={setTeaserShop}
                  placeholder="Boutique (optionnel)"
                  placeholderTextColor={c.textMuted}
                  style={[
                    styles.input,
                    {
                      color: c.text,
                      backgroundColor: "rgba(127,127,140,0.12)",
                    },
                  ]}
                />
                <TextInput
                  value={teaserPrice}
                  onChangeText={(v) => setTeaserPrice(sanitizePriceInput(v))}
                  keyboardType="decimal-pad"
                  placeholder="Prix USD"
                  placeholderTextColor={c.textMuted}
                  style={[
                    styles.input,
                    {
                      color: c.text,
                      backgroundColor: "rgba(127,127,140,0.12)",
                    },
                  ]}
                />
                <TextInput
                  value={teaserNote}
                  onChangeText={setTeaserNote}
                  placeholder="Note"
                  placeholderTextColor={c.textMuted}
                  style={[
                    styles.input,
                    {
                      color: c.text,
                      backgroundColor: "rgba(127,127,140,0.12)",
                    },
                  ]}
                />
                <MediaStrip
                  urls={teaserImage}
                  onChange={setTeaserImage}
                  max={1}
                  kind="images"
                  busy={mediaBusy}
                  setBusy={setMediaBusy}
                />
              </View>
            ) : null}

            <Text style={[styles.label, { color: c.textMuted }]}>Titre</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              maxLength={120}
              style={[
                styles.input,
                { color: c.text, backgroundColor: "rgba(127,127,140,0.12)" },
              ]}
            />
            <Text style={[styles.label, { color: c.textMuted }]}>Consigne</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={400}
              style={[
                styles.input,
                styles.area,
                { color: c.text, backgroundColor: "rgba(127,127,140,0.12)" },
              ]}
            />
            <Text style={[styles.label, { color: c.textMuted }]}>
              Catégorie
            </Text>
            <View style={styles.actions}>
              {categories.map((item) => {
                const on = category === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setCategory(item)}
                    style={[
                      styles.chip,
                      on
                        ? { backgroundColor: c.primary }
                        : { backgroundColor: "rgba(127,127,140,0.14)" },
                    ]}
                  >
                    <Text
                      style={{
                        color: on ? c.primaryForeground : c.textMuted,
                        fontWeight: "700",
                        fontSize: 11,
                      }}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="Ville"
                placeholderTextColor={c.textMuted}
                style={[
                  styles.input,
                  {
                    flex: 1,
                    color: c.text,
                    backgroundColor: "rgba(127,127,140,0.12)",
                  },
                ]}
              />
              {!editingId ? (
                <TextInput
                  value={hours}
                  onChangeText={setHours}
                  keyboardType="number-pad"
                  placeholder="Heures"
                  placeholderTextColor={c.textMuted}
                  style={[
                    styles.input,
                    {
                      width: 90,
                      color: c.text,
                      backgroundColor: "rgba(127,127,140,0.12)",
                    },
                  ]}
                />
              ) : null}
            </View>
            <Text style={[styles.label, { color: c.textMuted }]}>
              Spotlight (optionnel)
            </Text>
            <MediaStrip
              urls={spotlight}
              onChange={setSpotlight}
              max={1}
              kind="mixed"
              busy={mediaBusy}
              setBusy={setMediaBusy}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              {editingId ? (
                <Pressable
                  onPress={resetForm}
                  style={[
                    styles.primary,
                    { flex: 1, borderColor: HAIRLINE, borderWidth: 1 },
                  ]}
                >
                  <Text style={[styles.primaryText, { color: c.text }]}>
                    Annuler
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                disabled={busy || mediaBusy}
                onPress={() => void saveChallenge()}
                style={[
                  styles.primary,
                  {
                    flex: 1,
                    backgroundColor: c.primary,
                    opacity: busy || mediaBusy ? 0.5 : 1,
                  },
                ]}
              >
                <Text
                  style={[styles.primaryText, { color: c.primaryForeground }]}
                >
                  {busy ? "…" : editingId ? "Enregistrer" : "Publier"}
                </Text>
              </Pressable>
            </View>
          </View>

          <Text style={[styles.section, { color: c.text }]}>
            Actifs ({active.length})
          </Text>
          {pagedActive.visible.map((row) => renderRow(row))}
          <PagedMore
            hasMore={pagedActive.hasMore}
            remaining={pagedActive.remaining}
            onMore={pagedActive.more}
          />

          <Text style={[styles.section, { color: c.text }]}>
            Récents ({recent.length})
          </Text>
          {pagedRecent.visible.map((row) => renderRow(row, true))}
          <PagedMore
            hasMore={pagedRecent.hasMore}
            remaining={pagedRecent.remaining}
            onMore={pagedRecent.more}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 16,
  },
  backText: {
    fontWeight: "700",
    includeFontPadding: false,
    paddingRight: 12,
    flexShrink: 0,
  },
  title: { fontSize: 26, fontWeight: "800" },
  lead: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  section: { fontSize: 15, fontWeight: "800" },
  label: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  input: {
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  area: { minHeight: 88, textAlignVertical: "top" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 10,
    minHeight: 34,
    justifyContent: "center",
  },
  focusBtn: {
    borderRadius: 12,
    paddingHorizontal: 10,
    minHeight: 40,
    justifyContent: "center",
  },
  thumb: { width: 48, height: 48, borderRadius: 12 },
  primary: {
    borderRadius: 14,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontWeight: "800" },
});
