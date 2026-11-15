import { safeBack } from "@/src/nav";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PagedMore } from "@/components/ui/PagedMore";
import { api } from "@/src/api";
import {
    badgeKey,
    badgeLabel,
    MISSION_LABEL,
    type GrowthBadge,
    type GrowthMission,
    type LeaderboardRow,
} from "@/src/growth";
import { useT } from "@/src/i18n";
import { useSession } from "@/src/session";
import { useColors } from "@/src/use-colors";
import { usePaged } from "@/src/use-paged";

export function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColors();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);

  const me = useQuery({
    queryKey: ["growth-me", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () =>
      api<{
        badges?: GrowthBadge[];
        missions?: GrowthMission[];
        subscribers?: number;
        activeDays?: number;
        interactions?: number;
      }>("/api/growth/me"),
  });
  const board = useQuery({
    queryKey: ["growth-board", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () =>
      api<{
        global?: LeaderboardRow[];
        local?: LeaderboardRow[];
        city?: string;
      }>("/api/growth/leaderboard"),
  });

  const badges = Array.isArray(me.data?.badges) ? me.data.badges : [];
  const missions = Array.isArray(me.data?.missions) ? me.data.missions : [];
  const local = board.data?.local ?? [];
  const global = board.data?.global ?? [];
  const city = board.data?.city ?? "Kinshasa";

  return (
    <ScrollView
      style={[styles.wrap, { backgroundColor: c.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 20,
        gap: 14,
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
        <Text style={[styles.title, { color: c.text }]}>
          {t("communityTitle")}
        </Text>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          {t("missionsHint")}
          {me.data?.subscribers != null
            ? ` · ${me.data.subscribers} abonnés`
            : ""}
        </Text>
      </View>

      {!token ? (
        <View style={{ gap: 10 }}>
          <Text style={[styles.lead, { color: c.textMuted }]}>
            Connecte-toi pour les missions, badges et classements.
          </Text>
          <Pressable style={styles.primary} onPress={openAuth}>
            <Text style={styles.primaryText}>Se connecter</Text>
          </Pressable>
        </View>
      ) : me.isLoading ? (
        <ActivityIndicator color={c.emerald} />
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
                          ? "rgba(251,191,36,0.12)"
                          : "rgba(0,214,143,0.12)"
                        : "rgba(127,127,140,0.14)",
                    },
                  ]}
                >
                  <Ionicons
                    name={badge.kind === "INFLUENCER" ? "star" : "flame"}
                    size={12}
                    color={badge.kind === "INFLUENCER" ? "#FBBF24" : c.emerald}
                  />
                  <Text style={[styles.badgeText, { color: c.text }]}>
                    {badgeLabel(badge)}
                    {badge.active ? "" : " · en cours"}
                  </Text>
                  {badge.target ? (
                    <Text style={[styles.badgeMeta, { color: c.textMuted }]}>
                      {badge.progress ?? 0}/{badge.target}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          <View style={[styles.card, { backgroundColor: c.card }]}>
            <Text style={[styles.section, { color: c.text }]}>
              {t("weeklyMissions")}
            </Text>
            {missions.length === 0 ? (
              <Text style={[styles.empty, { color: c.textMuted }]}>
                {t("noScores")}
              </Text>
            ) : (
              missions.map((mission) => {
                const pct = Math.min(
                  100,
                  (mission.progress / Math.max(1, mission.target)) * 100,
                );
                return (
                  <View key={mission.key} style={{ gap: 6 }}>
                    <View style={styles.missionRow}>
                      <Text style={[styles.missionLabel, { color: c.text }]}>
                        {MISSION_LABEL[mission.key] ?? mission.key}
                      </Text>
                      <Text
                        style={{
                          color: mission.completed ? c.emerald : c.textMuted,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        {mission.progress}/{mission.target}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.bar,
                        { backgroundColor: "rgba(127,127,140,0.2)" },
                      ]}
                    >
                      <View
                        style={[
                          styles.barFill,
                          { width: `${pct}%`, backgroundColor: c.buyStart },
                        ]}
                      />
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <Board
            title={`${t("localBoard")} ${city}`}
            rows={local}
            empty={t("noScores")}
            text={c.text}
            muted={c.textMuted}
            card={c.card}
            pageSize={3}
          />
          <Board
            title={t("globalBoard")}
            rows={global}
            empty={t("noScores")}
            text={c.text}
            muted={c.textMuted}
            card={c.card}
            pageSize={3}
          />
        </>
      )}
    </ScrollView>
  );
}

function Board({
  title,
  rows,
  empty,
  text,
  muted,
  card,
  pageSize = 3,
}: {
  title: string;
  rows: LeaderboardRow[];
  empty: string;
  text: string;
  muted: string;
  card: string;
  pageSize?: number;
}) {
  const paged = usePaged(rows, `${title}-${rows.length}`, pageSize);
  return (
    <View style={[styles.card, { backgroundColor: card }]}>
      <Text style={[styles.section, { color: text }]}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={[styles.empty, { color: muted }]}>{empty}</Text>
      ) : (
        <>
          {paged.visible.map((row) => (
            <View key={`${title}-${row.rank}`} style={styles.boardRow}>
              <Text style={[styles.boardName, { color: text }]}>
                {row.rank}. {row.name}
              </Text>
              <Text style={{ color: muted, fontSize: 12, fontWeight: "700" }}>
                {row.interactions} pts · {row.activeDays} j
              </Text>
            </View>
          ))}
          <PagedMore
            hasMore={paged.hasMore}
            remaining={paged.remaining}
            onMore={paged.more}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 16,
    overflow: "visible",
  },
  backText: {
    fontWeight: "700",
    includeFontPadding: false,
    paddingRight: 12,
    flexShrink: 0,
  },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.3 },
  lead: { lineHeight: 20, marginTop: 4, fontSize: 14, fontWeight: "600" },
  primary: {
    backgroundColor: "#FF7A00",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "800",
    includeFontPadding: false,
    paddingRight: 8,
    flexShrink: 0,
  },
  badgeMeta: { fontSize: 12, fontWeight: "700" },
  card: { borderRadius: 18, padding: 14, gap: 10 },
  section: { fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  empty: { fontSize: 13, fontWeight: "600" },
  missionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  missionLabel: { flex: 1, fontSize: 14, fontWeight: "700" },
  bar: { height: 6, borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 999 },
  boardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  boardName: { flex: 1, fontSize: 14, fontWeight: "700" },
});
