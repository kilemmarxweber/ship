import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { safeBack } from "@/src/nav";
import { useState } from "react";
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

import { PagedMore } from "@/components/ui/PagedMore";
import { api } from "@/src/api";
import { formatMoney } from "@/src/format";
import {
    badgeKey,
    badgeLabel,
    INFLUENCER_FOLLOWERS,
    type GrowthBadge,
} from "@/src/growth";
import { useT } from "@/src/i18n";
import { useSession } from "@/src/session";
import { HAIRLINE } from "@/src/theme";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";
import { usePaged } from "@/src/use-paged";

type GrowthMe = {
  badges?: GrowthBadge[];
  subscribers?: number;
  kycApproved?: boolean;
  isPlatformOwner?: boolean;
};

type GiftRow = {
  id: string;
  kind: string;
  amountCents: number;
  from: { name: string };
};

type LiveRow = {
  id: string;
  title: string;
  status?: string;
  user?: { id: string };
};

export function CreatorStudioScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("Live shopping");
  /** Défaut off = live host-only. */
  const [allowGuests, setAllowGuests] = useState(false);
  const [busy, setBusy] = useState(false);

  const me = useQuery({
    queryKey: ["growth-me", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () => api<GrowthMe>("/api/growth/me"),
  });
  const gifts = useQuery({
    queryKey: ["growth-gifts", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () =>
      api<{ received?: GiftRow[] }>("/api/growth/gifts").catch(() => ({
        received: [] as GiftRow[],
      })),
  });
  const lives = useQuery({
    queryKey: ["growth-lives", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () =>
      api<{ lives?: LiveRow[] }>("/api/growth/lives").catch(() => ({
        lives: [] as LiveRow[],
      })),
  });

  const badges = Array.isArray(me.data?.badges) ? me.data.badges : [];
  const received = gifts.data?.received ?? [];
  const pagedGifts = usePaged(received, String(received.length), 10);
  const influencer = badges.some(
    (badge) => badge.kind === "INFLUENCER" && badge.active,
  );
  const canGoLive = Boolean(influencer || me.data?.isPlatformOwner);
  const subscribers = me.data?.subscribers ?? 0;
  const need = Math.max(0, INFLUENCER_FOLLOWERS - subscribers);
  const activeLive = (lives.data?.lives ?? []).find(
    (row) => row.status === "LIVE" || row.status === "PAUSED",
  );

  async function startLive() {
    if (busy || title.trim().length < 2) return;
    setBusy(true);
    try {
      const data = await api<{ live?: { id: string } }>("/api/growth/lives", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim() || "Live shopping",
          allowGuests,
        }),
      });
      if (!data.live?.id) throw new Error("Live impossible");
      await queryClient.invalidateQueries({ queryKey: ["growth-lives"] });
      router.push(`/live/${data.live.id}` as Href);
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Live impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={[styles.wrap, { backgroundColor: c.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 16,
        gap: 14,
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
        <Text style={[styles.title, { color: c.text }]}>Studio créateur</Text>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          {me.data?.isPlatformOwner
            ? "Owner plateforme : live, cadeaux et pub sans seuil d’abonnés."
            : `${subscribers} abonnés · cadeaux et pub rémunérée avec le badge Influenceur.`}
        </Text>
      </View>

      {!token ? (
        <View style={{ gap: 10 }}>
          <Text style={[styles.lead, { color: c.textMuted }]}>
            Connectez-vous pour le studio créateur.
          </Text>
          <Pressable
            style={[styles.primary, { backgroundColor: c.primary }]}
            onPress={openAuth}
          >
            <Text style={[styles.primaryText, { color: c.primaryForeground }]}>
              Se connecter
            </Text>
          </Pressable>
        </View>
      ) : me.isLoading ? (
        <ActivityIndicator color={c.primary} />
      ) : (
        <>
          {badges.length > 0 ? (
            <View style={styles.badgeRow}>
              {badges.map((badge, index) => (
                <View
                  key={badgeKey(badge, index)}
                  style={[
                    styles.badge,
                    {
                      backgroundColor: badge.active
                        ? badge.kind === "INFLUENCER"
                          ? "rgba(251,191,36,0.14)"
                          : `${c.emerald}22`
                        : "rgba(127,127,140,0.14)",
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: badge.active
                        ? badge.kind === "INFLUENCER"
                          ? "#FBBF24"
                          : c.emerald
                        : c.textMuted,
                      fontWeight: "800",
                      fontSize: 11,
                    }}
                  >
                    {badgeLabel(badge)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {!me.data?.kycApproved && !me.data?.isPlatformOwner ? (
            <Pressable onPress={() => router.push("/kyc" as Href)}>
              <Text
                style={{ color: c.primary, fontWeight: "700", fontSize: 12 }}
              >
                Vérifiez votre identité (KYC) pour monétiser
              </Text>
            </Pressable>
          ) : null}

          <View
            style={[
              styles.liveCard,
              { backgroundColor: c.card, borderColor: `${c.live}55` },
            ]}
          >
            <View style={styles.liveHead}>
              <View style={[styles.liveDot, { backgroundColor: c.live }]} />
              <Text style={[styles.liveTitle, { color: c.text }]}>
                {activeLive
                  ? activeLive.status === "PAUSED"
                    ? "Live en pause"
                    : "Vous êtes en direct"
                  : "Lancer un live"}
              </Text>
            </View>
            {activeLive ? (
              <Pressable
                onPress={() => router.push(`/live/${activeLive.id}` as Href)}
                style={[styles.goLive, { backgroundColor: c.live }]}
              >
                <Ionicons name="radio" size={16} color="#fff" />
                <Text style={styles.goLiveText}>
                  {activeLive.status === "PAUSED" ? "Reprendre" : "Ouvrir"}
                </Text>
              </Pressable>
            ) : canGoLive ? (
              <View style={{ gap: 8 }}>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  maxLength={80}
                  placeholder="Titre du live"
                  placeholderTextColor={c.textMuted}
                  style={[
                    styles.input,
                    {
                      color: c.text,
                      backgroundColor: "rgba(127,127,140,0.12)",
                    },
                  ]}
                />
                <Pressable
                  onPress={() => setAllowGuests((v) => !v)}
                  style={styles.guestToggle}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: allowGuests }}
                >
                  <Ionicons
                    name={allowGuests ? "checkbox" : "square-outline"}
                    size={20}
                    color={allowGuests ? c.live : c.textMuted}
                  />
                  <Text
                    style={[styles.guestToggleText, { color: c.textMuted }]}
                  >
                    Autoriser les viewers à monter sur scène
                  </Text>
                </Pressable>
                <Pressable
                  disabled={busy || title.trim().length < 2}
                  onPress={() => void startLive()}
                  style={[
                    styles.goLive,
                    {
                      backgroundColor: c.live,
                      opacity: busy || title.trim().length < 2 ? 0.5 : 1,
                    },
                  ]}
                >
                  <Ionicons name="radio" size={16} color="#fff" />
                  <Text style={styles.goLiveText}>
                    {busy ? "…" : "Go live"}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Text
                style={{ color: c.textMuted, fontSize: 13, lineHeight: 18 }}
              >
                {need > 0
                  ? `Encore ${need.toLocaleString("fr-FR")} abonnés + KYC`
                  : "Finalisez le KYC Influenceur pour passer en live."}
              </Text>
            )}
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: c.card, borderColor: HAIRLINE },
            ]}
          >
            <Text style={[styles.section, { color: c.text }]}>
              Cadeaux reçus
            </Text>
            {received.length === 0 ? (
              <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 6 }}>
                Aucun cadeau encore.
              </Text>
            ) : (
              <View style={{ gap: 8, marginTop: 8 }}>
                {pagedGifts.visible.map((gift) => (
                  <View key={gift.id} style={styles.giftRow}>
                    <Text
                      style={[styles.giftName, { color: c.text }]}
                      numberOfLines={1}
                    >
                      {gift.from.name} · {gift.kind}
                    </Text>
                    <Text style={{ color: c.emerald, fontWeight: "800" }}>
                      {formatMoney(gift.amountCents)}
                    </Text>
                  </View>
                ))}
                <PagedMore
                  hasMore={pagedGifts.hasMore}
                  remaining={pagedGifts.remaining}
                  onMore={pagedGifts.more}
                />
              </View>
            )}
          </View>
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
  lead: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  liveHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveTitle: { fontSize: 16, fontWeight: "800", flex: 1 },
  input: {
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  goLive: {
    minHeight: 44,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
  },
  goLiveText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  guestToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  guestToggleText: { flex: 1, fontSize: 12, fontWeight: "700", lineHeight: 16 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  section: { fontSize: 14, fontWeight: "800" },
  giftRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 36,
  },
  giftName: { flex: 1, fontSize: 13, fontWeight: "600" },
  primary: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { fontWeight: "800" },
});
