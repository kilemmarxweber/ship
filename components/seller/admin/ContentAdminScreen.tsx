import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PagedMore } from "@/components/ui/PagedMore";
import { api } from "@/src/api";
import { useT } from "@/src/i18n";
import { useSession } from "@/src/session";
import { HAIRLINE } from "@/src/theme";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";
import { usePaged } from "@/src/use-paged";

type ReviewRow = {
  id: string;
  kind: string;
  variant: string;
  contentHash: string;
  note: string | null;
  user: { id: string; name: string; email: string };
};

type Payload = {
  source: "system" | "sanity";
  activeSource: "system" | "sanity";
  sanityConfigured: boolean;
  projectId: string | null;
  dataset: string;
  nsfwReview: boolean;
  rekognitionActive: boolean;
  clipSeconds: number;
  maxImages: number;
  catalogTrackCount: number;
  reviews: ReviewRow[];
};

type Draft = { id: string; title: string; status: string; kind: string };

export function ContentAdminScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");

  const q = useQuery({
    queryKey: ["admin-content", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () => api<Payload>("/api/admin/content-source"),
    retry: false,
  });
  const draftsQ = useQuery({
    queryKey: ["admin-campaigns-drafts", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () =>
      api<{ campaigns?: Draft[] }>("/api/admin/brand-campaigns").catch(() => ({
        campaigns: [] as Draft[],
      })),
  });

  const data = q.data;
  const reviews = data?.reviews ?? [];
  const pagedReviews = usePaged(reviews, String(reviews.length));
  const drafts = draftsQ.data?.campaigns ?? [];

  async function save(source: "system" | "sanity", nsfwReview: boolean) {
    setBusy(true);
    try {
      await api("/api/admin/content-source", {
        method: "POST",
        body: JSON.stringify({ source, nsfwReview }),
      });
      showToast("Source enregistrée", "success");
      await queryClient.invalidateQueries({ queryKey: ["admin-content"] });
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Enregistrement impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function markDone(id: string) {
    setBusy(true);
    try {
      await api("/api/admin/content-source", {
        method: "POST",
        body: JSON.stringify({
          source: data?.source ?? "system",
          reviewId: id,
          reviewStatus: "done",
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-content"] });
    } finally {
      setBusy(false);
    }
  }

  async function createDraft() {
    if (!draftTitle.trim()) return;
    try {
      await api("/api/admin/brand-campaigns", {
        method: "POST",
        body: JSON.stringify({ title: draftTitle.trim(), status: "DRAFT" }),
      });
      setDraftTitle("");
      await queryClient.invalidateQueries({
        queryKey: ["admin-campaigns-drafts"],
      });
      showToast("Brouillon créé", "success");
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Campagne impossible",
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
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Ionicons name="chevron-back" size={20} color={c.text} />
        <Text style={[styles.backText, { color: c.text }]} numberOfLines={1}>
          {t("back")}
          {"\u00A0"}
        </Text>
      </Pressable>
      <View>
        <Text style={[styles.title, { color: c.text }]}>Contenu</Text>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          Basculez entre Config système et Sanity. Rekognition reste le scanner
          NSFW optionnel.
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
      ) : q.isError || !data ? (
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
          {!data.sanityConfigured ? (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: "rgba(251,191,36,0.12)",
                  borderColor: "rgba(251,191,36,0.4)",
                },
              ]}
            >
              <Text style={{ color: "#FBBF24", fontWeight: "800" }}>
                Sanity n’est pas encore branché
              </Text>
              <Text
                style={{ color: c.textMuted, fontSize: 12, lineHeight: 18 }}
              >
                Créez un projet sur sanity.io/manage, renseignez
                NEXT_PUBLIC_SANITY_PROJECT_ID / DATASET côté serveur,
                redémarrez, puis choisissez le radio Sanity ici.
              </Text>
            </View>
          ) : null}

          <View
            style={[
              styles.card,
              { backgroundColor: c.card, borderColor: HAIRLINE },
            ]}
          >
            <Text style={[styles.section, { color: c.text }]}>
              Source des règles
            </Text>
            {(
              [
                [
                  "system",
                  "Système",
                  "Minute de son, 12 images, seeds Prisma, fichiers locaux.",
                ],
                [
                  "sanity",
                  "Sanity",
                  data.sanityConfigured
                    ? `Projet ${data.projectId} · dataset ${data.dataset}`
                    : "Indisponible : pas de NEXT_PUBLIC_SANITY_PROJECT_ID",
                ],
              ] as const
            ).map(([key, label, hint]) => {
              const on = data.source === key;
              const disabled = key === "sanity" && !data.sanityConfigured;
              return (
                <Pressable
                  key={key}
                  disabled={busy || disabled}
                  onPress={() => void save(key, data.nsfwReview)}
                  style={[
                    styles.radio,
                    {
                      borderColor: on ? c.primary : HAIRLINE,
                      opacity: disabled ? 0.55 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={on ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color={on ? c.primary : c.textMuted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontWeight: "700" }}>
                      {label}
                    </Text>
                    <Text style={{ color: c.textMuted, fontSize: 11 }}>
                      {hint}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            <Text style={{ color: c.textMuted, fontSize: 11 }}>
              Actif : {data.activeSource === "sanity" ? "Sanity" : "Système"} ·{" "}
              {data.clipSeconds}s · {data.maxImages} images ·{" "}
              {data.catalogTrackCount} sons
            </Text>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: c.card, borderColor: HAIRLINE },
            ]}
          >
            <Text style={[styles.section, { color: c.text }]}>
              Médias catalogue
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 12 }}>
              Sons plateforme dans Sanity (CDN). Photos d’annonces restent sur
              le disque en phase 1.
            </Text>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: c.card, borderColor: HAIRLINE },
            ]}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons name="shield-outline" size={16} color={c.text} />
              <Text style={[styles.section, { color: c.text }]}>NSFW</Text>
            </View>
            <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 18 }}>
              Pornographie interdite (non désactivable). Rekognition :{" "}
              {data.rekognitionActive ? "scanner actif" : "pas de clés AWS"}.
            </Text>
            <View style={styles.switchRow}>
              <Text style={{ color: c.text, flex: 1, fontSize: 13 }}>
                File owner pour les médias suggestifs détectés
              </Text>
              <Switch
                value={data.nsfwReview}
                disabled={busy}
                onValueChange={(value) => void save(data.source, value)}
                trackColor={{ true: c.primary, false: "rgba(127,127,140,0.3)" }}
              />
            </View>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: c.card, borderColor: HAIRLINE },
            ]}
          >
            <Text style={[styles.section, { color: c.text }]}>
              ShipAds (brouillons)
            </Text>
            <Pressable
              onPress={() => router.push("/shops/admin/campaigns" as Href)}
            >
              <Text
                style={{ color: c.primary, fontWeight: "700", fontSize: 12 }}
              >
                Packs Discovery / Engagement / Conversion →
              </Text>
            </Pressable>
            <Text style={{ color: c.textMuted, fontSize: 11 }}>
              À activer seulement avec audience et attribution réelles.
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={draftTitle}
                onChangeText={setDraftTitle}
                placeholder="Campagne marque"
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
              <Pressable
                onPress={() => void createDraft()}
                style={[
                  styles.primary,
                  { backgroundColor: c.primary, paddingHorizontal: 14 },
                ]}
              >
                <Text
                  style={[styles.primaryText, { color: c.primaryForeground }]}
                >
                  Brouillon
                </Text>
              </Pressable>
            </View>
            {drafts.map((row) => (
              <Text key={row.id} style={{ color: c.textMuted, fontSize: 11 }}>
                {row.title} · {row.kind} · {row.status}
              </Text>
            ))}
          </View>

          {reviews.length > 0 ? (
            <View
              style={[
                styles.card,
                { backgroundColor: c.card, borderColor: HAIRLINE },
              ]}
            >
              <Text style={[styles.section, { color: c.text }]}>
                File à revoir
              </Text>
              {pagedReviews.visible.map((row) => (
                <View
                  key={row.id}
                  style={[styles.review, { borderColor: HAIRLINE }]}
                >
                  <Text
                    style={{ color: c.text, fontWeight: "700", fontSize: 13 }}
                  >
                    {row.user.name} · {row.kind}/{row.variant}
                  </Text>
                  <Text style={{ color: c.textMuted, fontSize: 11 }}>
                    {row.contentHash.slice(0, 24)}…
                  </Text>
                  <Pressable
                    disabled={busy}
                    onPress={() => void markDone(row.id)}
                    style={[styles.chip, { borderColor: HAIRLINE }]}
                  >
                    <Text
                      style={{
                        color: c.primary,
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      Marquer traité
                    </Text>
                  </Pressable>
                </View>
              ))}
              <PagedMore
                hasMore={pagedReviews.hasMore}
                remaining={pagedReviews.remaining}
                onMore={pagedReviews.more}
              />
            </View>
          ) : null}
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
  section: { fontSize: 14, fontWeight: "800" },
  radio: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: "flex-start",
  },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  review: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
  chip: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    minHeight: 34,
    justifyContent: "center",
  },
  primary: {
    borderRadius: 14,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontWeight: "800" },
});
