import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { safeBack } from "@/src/nav";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
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

type ModUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  disabledAt: string | null;
  disabledReason: string | null;
  nsfwStrikeCount: number;
};

type EventRow = {
  id: string;
  variant: string;
  kind: string;
  decision: string;
  score: number;
  contentHash: string;
  createdAt: string;
  user: ModUser;
};

export function ModerationAdminScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-moderation", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () =>
      api<{ events?: EventRow[]; disabled?: ModUser[] }>(
        "/api/admin/moderation",
      ),
    retry: false,
  });

  const disabled = q.data?.disabled ?? [];
  const events = q.data?.events ?? [];
  const pagedEvents = usePaged(events, String(events.length));

  function reactivate(userId: string) {
    Alert.alert(
      "Réactiver le compte ?",
      "Les boutiques seront rouvertes ; les produits restent masqués.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Réactiver",
          onPress: () => {
            void (async () => {
              setBusyId(userId);
              try {
                await api("/api/admin/moderation", {
                  method: "POST",
                  body: JSON.stringify({ userId, action: "reactivate" }),
                });
                showToast("Compte réactivé", "success");
                await queryClient.invalidateQueries({
                  queryKey: ["admin-moderation"],
                });
              } catch (cause) {
                showToast(
                  cause instanceof Error
                    ? cause.message
                    : "Réactivation impossible",
                  "error",
                );
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ],
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
    >
      <Pressable onPress={() => safeBack()} style={styles.back}>
        <Ionicons name="chevron-back" size={20} color={c.text} />
        <Text style={[styles.backText, { color: c.text }]} numberOfLines={1}>
          {t("back")}
          {"\u00A0"}
        </Text>
      </Pressable>
      <View>
        <Text style={[styles.title, { color: c.text }]}>Modération médias</Text>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          Scans NSFW catalogue. Les fichiers refusés ne sont pas stockés. Pas
          d’auto-réactivation.
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
          Réservé à l’owner ou à un admin Chip Shop.
        </Text>
      ) : (
        <>
          <Text style={[styles.section, { color: c.text }]}>
            Comptes désactivés
          </Text>
          {disabled.length === 0 ? (
            <Text style={{ color: c.textMuted, fontSize: 12 }}>
              Aucun compte gelé.
            </Text>
          ) : (
            disabled.map((u) => (
              <View
                key={u.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: "rgba(251,191,36,0.12)",
                    borderColor: "rgba(251,191,36,0.4)",
                  },
                ]}
              >
                <Text style={{ color: c.text, fontWeight: "800" }}>
                  {u.name}
                </Text>
                <Text style={{ color: c.textMuted, fontSize: 11 }}>
                  {u.email} · {u.disabledReason ?? "—"} · {u.nsfwStrikeCount}{" "}
                  strike(s)
                </Text>
                <Pressable
                  disabled={busyId === u.id}
                  onPress={() => reactivate(u.id)}
                  style={[styles.btn, { backgroundColor: c.primary }]}
                >
                  <Text
                    style={{ color: c.primaryForeground, fontWeight: "800" }}
                  >
                    {busyId === u.id ? "…" : "Réactiver"}
                  </Text>
                </Pressable>
              </View>
            ))
          )}

          <Text style={[styles.section, { color: c.text }]}>
            Événements récents
          </Text>
          {pagedEvents.visible.map((row) => (
            <View
              key={row.id}
              style={[
                styles.card,
                { backgroundColor: c.card, borderColor: HAIRLINE },
              ]}
            >
              <Text style={{ color: c.text, fontWeight: "800" }}>
                {row.user.name} · {row.kind}/{row.variant}
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 11 }}>
                {row.decision} · score {row.score} ·{" "}
                {new Date(row.createdAt).toLocaleString("fr-FR")}
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 10 }}>
                {row.contentHash.slice(0, 28)}…
              </Text>
            </View>
          ))}
          <PagedMore
            hasMore={pagedEvents.hasMore}
            remaining={pagedEvents.remaining}
            onMore={pagedEvents.more}
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
  section: { fontSize: 15, fontWeight: "800" },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 6 },
  btn: {
    alignSelf: "flex-start",
    borderRadius: 12,
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  primaryText: { fontWeight: "800" },
});
