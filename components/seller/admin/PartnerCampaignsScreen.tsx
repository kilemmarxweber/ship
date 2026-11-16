import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { safeBack } from "@/src/nav";
import { useMemo, useState } from "react";
import {
    ActivityIndicator,
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
import { formatMoney } from "@/src/format";
import { useT } from "@/src/i18n";
import { useSession } from "@/src/session";
import {
    normalizeStoryTemplate,
    STORY_TEMPLATES,
    type StoryTemplateId,
} from "@/src/story-templates";
import { HAIRLINE } from "@/src/theme";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";
import { usePaged } from "@/src/use-paged";

type Pack = {
  objective: "DISCOVERY" | "ENGAGEMENT" | "CONVERSION";
  kind: string;
  minBudgetCents: number;
  maxBudgetCents: number;
};

type Campaign = {
  id: string;
  title: string;
  kind: string;
  objective: string;
  status: string;
  budgetCents: number;
  impressions: number;
  clicks: number;
  conversions: number;
  body?: string | null;
  mediaUrl?: string | null;
  ctaUrl?: string | null;
  productId?: string | null;
  category?: string | null;
};

type DestMode = "product" | "link" | "discover";

const DEST_OPTIONS: { id: DestMode; label: string; hint: string }[] = [
  { id: "product", label: "Produit", hint: "Ouvre une fiche boutique" },
  { id: "link", label: "Lien", hint: "/discover, /product/… ou https://" },
  { id: "discover", label: "Découvrir", hint: "Fallback sûr — jamais de 404" },
];

function StoryPreview({
  title,
  body,
  mediaUrl: uri,
  template,
}: {
  title: string;
  body: string;
  mediaUrl: string | null;
  template: StoryTemplateId;
}) {
  const cover = mediaUrl(uri);
  return (
    <View style={styles.preview}>
      {cover ? (
        <Image
          source={{ uri: cover }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: "#1a1a22" }]}
        />
      )}
      <View style={styles.previewShade} />
      {template === "quote" ? (
        <View style={styles.previewCenter}>
          <Text style={styles.previewQuote} numberOfLines={4}>
            « {body.trim() || title.trim() || "Citation"} »
          </Text>
        </View>
      ) : (
        <View style={styles.previewBottom}>
          <Text style={styles.previewTitle} numberOfLines={2}>
            {title.trim() || "Titre story"}
          </Text>
          {body.trim() ? (
            <Text style={styles.previewBody} numberOfLines={2}>
              {body.trim()}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

export function PartnerCampaignsScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [media, setMedia] = useState<string[]>([]);
  const [template, setTemplate] = useState<StoryTemplateId>("cover");
  const [dest, setDest] = useState<DestMode>("product");
  const [product, setProduct] = useState<AdminProductHit | null>(null);
  const [objective, setObjective] = useState<Pack["objective"]>("DISCOVERY");
  const [busy, setBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [showPacks, setShowPacks] = useState(false);

  const q = useQuery({
    queryKey: ["admin-campaigns", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () =>
      api<{ campaigns?: Campaign[]; packs?: Pack[] }>(
        "/api/admin/brand-campaigns",
      ),
    retry: false,
  });

  const packs = q.data?.packs ?? [];
  const stories = useMemo(
    () => (q.data?.campaigns ?? []).filter((row) => row.kind === "STORY"),
    [q.data?.campaigns],
  );
  const paged = usePaged(stories, String(stories.length));
  const pack = packs.find((p) => p.objective === objective);
  const activeCount = stories.filter((r) => r.status === "ACTIVE").length;
  const mediaUrlValue = media[0] ?? null;

  function resetForm() {
    setTitle("");
    setBody("");
    setCtaUrl("");
    setMedia([]);
    setTemplate("cover");
    setDest("product");
    setProduct(null);
    setObjective("DISCOVERY");
  }

  async function createStory() {
    if (!title.trim()) {
      showToast("Titre requis", "error");
      return;
    }
    if (dest === "product" && !product) {
      showToast(
        "Choisissez un produit publié, ou passez en Lien / Découvrir",
        "error",
      );
      return;
    }
    if (dest === "link" && !ctaUrl.trim()) {
      showToast("Indiquez un lien CTA", "error");
      return;
    }
    setBusy(true);
    try {
      await api("/api/admin/brand-campaigns", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          objective,
          kind: "STORY",
          status: "ACTIVE",
          budgetCents: pack?.minBudgetCents,
          body: body.trim() || null,
          mediaUrl: mediaUrlValue,
          ctaUrl:
            dest === "link"
              ? ctaUrl.trim()
              : dest === "discover"
                ? "/discover"
                : null,
          productId: dest === "product" ? (product?.id ?? null) : null,
          category: template,
        }),
      });
      showToast("Story active sur Découvrir", "success");
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Story impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      await api("/api/admin/brand-campaigns", {
        method: "PATCH",
        body: JSON.stringify({ id, status }),
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Mise à jour impossible",
        "error",
      );
    }
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
      <Pressable onPress={() => safeBack()} style={styles.back}>
        <Ionicons name="chevron-back" size={20} color={c.text} />
        <Text style={[styles.backText, { color: c.text }]} numberOfLines={1}>
          {t("back")}
          {"\u00A0"}
        </Text>
      </Pressable>

      <View>
        <Text style={[styles.title, { color: c.text }]}>
          Stories partenaires
        </Text>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          Composez une carte 3:4 — elle apparaît dans Découvrir.
        </Text>
        <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 4 }}>
          {activeCount} active{activeCount === 1 ? "" : "s"} · {stories.length}{" "}
          au total
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
            <Text style={[styles.label, { color: c.textMuted }]}>Template</Text>
            <View style={styles.grid4}>
              {STORY_TEMPLATES.map((item) => {
                const on = template === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setTemplate(item.id)}
                    style={[
                      styles.tpl,
                      {
                        borderColor: on ? c.primary : HAIRLINE,
                        backgroundColor: on ? `${c.primary}18` : c.background,
                      },
                    ]}
                  >
                    <Text
                      style={{ color: c.text, fontWeight: "800", fontSize: 11 }}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={{ color: c.textMuted, fontSize: 9 }}
                      numberOfLines={2}
                    >
                      {item.hint}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: c.textMuted }]}>Visuel</Text>
            <MediaStrip
              urls={media}
              onChange={setMedia}
              max={1}
              kind="images"
              busy={mediaBusy}
              setBusy={setMediaBusy}
            />

            <Text style={[styles.label, { color: c.textMuted }]}>Titre</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              maxLength={120}
              placeholder="Ex. Drop mode Kin"
              placeholderTextColor={c.textMuted}
              style={[
                styles.input,
                { color: c.text, backgroundColor: "rgba(127,127,140,0.12)" },
              ]}
            />
            <Text style={[styles.label, { color: c.textMuted }]}>Accroche</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              maxLength={280}
              multiline
              placeholder="Promo, citation, mode d’emploi…"
              placeholderTextColor={c.textMuted}
              style={[
                styles.input,
                styles.area,
                { color: c.text, backgroundColor: "rgba(127,127,140,0.12)" },
              ]}
            />
            <Text
              style={{ color: c.textMuted, fontSize: 10, textAlign: "right" }}
            >
              {body.length}/280
            </Text>

            <Text style={[styles.label, { color: c.textMuted }]}>
              Destination au clic
            </Text>
            <View style={styles.row3}>
              {DEST_OPTIONS.map((opt) => {
                const on = dest === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setDest(opt.id)}
                    style={[
                      styles.dest,
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
              {DEST_OPTIONS.find((o) => o.id === dest)?.hint}
            </Text>
            {dest === "product" ? (
              <AdminProductPicker
                selected={product}
                onSelect={(p) => {
                  setProduct(p);
                  if (!title.trim()) setTitle(p.title.slice(0, 120));
                  if (!media.length && p.images[0]) setMedia([p.images[0]]);
                }}
                onClear={() => setProduct(null)}
              />
            ) : null}
            {dest === "link" ? (
              <TextInput
                value={ctaUrl}
                onChangeText={setCtaUrl}
                placeholder="/discover ou https://…"
                placeholderTextColor={c.textMuted}
                style={[
                  styles.input,
                  { color: c.text, backgroundColor: "rgba(127,127,140,0.12)" },
                ]}
              />
            ) : null}

            <Pressable onPress={() => setShowPacks((v) => !v)}>
              <Text
                style={{ color: c.textMuted, fontWeight: "700", fontSize: 12 }}
              >
                Pack budget (optionnel) {showPacks ? "▾" : "▸"}
              </Text>
            </Pressable>
            {showPacks ? (
              <View style={styles.wrapChips}>
                {packs.map((p) => {
                  const on = objective === p.objective;
                  return (
                    <Pressable
                      key={p.objective}
                      onPress={() => setObjective(p.objective)}
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
                          fontWeight: "800",
                          fontSize: 11,
                        }}
                      >
                        {p.objective} · {formatMoney(p.minBudgetCents)}+
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <View style={{ alignItems: "center", gap: 8, marginTop: 4 }}>
              <Text
                style={{ color: c.textMuted, fontSize: 10, fontWeight: "700" }}
              >
                APERÇU DÉCOUVRIR
              </Text>
              <StoryPreview
                title={title}
                body={body}
                mediaUrl={mediaUrlValue}
                template={template}
              />
              <Text
                style={{
                  color: c.textMuted,
                  fontSize: 10,
                  textAlign: "center",
                }}
              >
                {dest === "product" && product
                  ? `→ ${product.title}`
                  : dest === "link" && ctaUrl.trim()
                    ? `→ ${ctaUrl.trim()}`
                    : "→ Découvrir"}
              </Text>
            </View>

            <Pressable
              disabled={busy || mediaBusy || !title.trim()}
              onPress={() => void createStory()}
              style={[
                styles.primary,
                {
                  backgroundColor: c.primary,
                  opacity: busy || mediaBusy || !title.trim() ? 0.5 : 1,
                },
              ]}
            >
              <Text
                style={[styles.primaryText, { color: c.primaryForeground }]}
              >
                {busy ? "Publication…" : "Publier la story"}
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.section, { color: c.text }]}>Bibliothèque</Text>
          {stories.length === 0 ? (
            <Text
              style={{
                color: c.textMuted,
                textAlign: "center",
                paddingVertical: 20,
              }}
            >
              Aucune story — publiez-en une ci-dessus.
            </Text>
          ) : (
            <>
              {paged.visible.map((row) => {
                const tpl = normalizeStoryTemplate(row.category);
                const tplLabel =
                  STORY_TEMPLATES.find((item) => item.id === tpl)?.label ?? tpl;
                return (
                  <View
                    key={row.id}
                    style={[
                      styles.libCard,
                      { backgroundColor: c.card, borderColor: HAIRLINE },
                    ]}
                  >
                    <StoryPreview
                      title={row.title}
                      body={row.body ?? ""}
                      mediaUrl={row.mediaUrl ?? null}
                      template={tpl}
                    />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text
                        style={{ color: c.text, fontWeight: "800" }}
                        numberOfLines={1}
                      >
                        {row.title}
                      </Text>
                      <Text
                        style={{
                          color: c.primary,
                          fontSize: 11,
                          fontWeight: "800",
                        }}
                      >
                        {row.status}
                      </Text>
                      <Text style={{ color: c.textMuted, fontSize: 11 }}>
                        {tplLabel}
                        {row.productId ? " · fiche produit" : ""}
                        {row.ctaUrl ? ` · ${row.ctaUrl}` : ""}
                      </Text>
                      <Text style={{ color: c.textMuted, fontSize: 11 }}>
                        {row.impressions} vues · {row.clicks} clics
                      </Text>
                      <View style={styles.wrapChips}>
                        {row.status === "ACTIVE" ? (
                          <Pressable
                            onPress={() => void setStatus(row.id, "PAUSED")}
                            style={[
                              styles.chip,
                              { borderColor: HAIRLINE, borderWidth: 1 },
                            ]}
                          >
                            <Text
                              style={{
                                color: c.text,
                                fontWeight: "700",
                                fontSize: 11,
                              }}
                            >
                              Pause
                            </Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            onPress={() => void setStatus(row.id, "ACTIVE")}
                            style={[
                              styles.chip,
                              { backgroundColor: c.primary },
                            ]}
                          >
                            <Text
                              style={{
                                color: c.primaryForeground,
                                fontWeight: "700",
                                fontSize: 11,
                              }}
                            >
                              {row.status === "ENDED" ? "Réactiver" : "Activer"}
                            </Text>
                          </Pressable>
                        )}
                        {row.status !== "ENDED" ? (
                          <Pressable
                            onPress={() => void setStatus(row.id, "ENDED")}
                            style={[
                              styles.chip,
                              {
                                borderColor: "rgba(255,69,58,0.4)",
                                borderWidth: 1,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: "#FF453A",
                                fontWeight: "700",
                                fontSize: 11,
                              }}
                            >
                              Terminer
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
              <PagedMore
                hasMore={paged.hasMore}
                remaining={paged.remaining}
                onMore={paged.more}
              />
            </>
          )}
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
  label: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  grid4: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tpl: {
    width: "48%",
    flexGrow: 1,
    flexBasis: "46%",
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    gap: 4,
    minHeight: 64,
  },
  input: {
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  area: { minHeight: 88, textAlignVertical: "top" },
  row3: { flexDirection: "row", gap: 6 },
  dest: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  wrapChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    minHeight: 32,
    justifyContent: "center",
  },
  preview: {
    width: 160,
    height: 214,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#121218",
  },
  previewShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  previewCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  previewQuote: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
    textAlign: "center",
  },
  previewBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    gap: 4,
  },
  previewTitle: { color: "#fff", fontWeight: "800", fontSize: 13 },
  previewBody: { color: "rgba(255,255,255,0.75)", fontSize: 11 },
  section: { fontSize: 15, fontWeight: "800" },
  libCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    gap: 12,
  },
  primary: {
    borderRadius: 14,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontWeight: "800" },
});
