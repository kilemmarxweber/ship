import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { api, mediaUrl } from "@/src/api";
import { compactCount } from "@/src/format";
import {
    conversationAvatar,
    conversationTitle,
    markConversationSeenLocal,
    removeConversationLocal,
    useInbox,
    type InboxConversation,
} from "@/src/inbox";
import { useMe } from "@/src/me";
import { useSession } from "@/src/session";
import { colors } from "@/src/theme";
import { showToast } from "@/src/toast";

type InboxFilter = "all" | "unread" | "read";

function timeLabel(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isUnread(row: InboxConversation) {
  return (row.unreadCount ?? 0) > 0 || Boolean(row.urgentPending);
}

function Avatar({ uri, name }: { uri: string | null; name: string }) {
  if (uri) {
    return (
      <Image
        source={{ uri: mediaUrl(uri) ?? uri }}
        style={styles.avatar}
        contentFit="cover"
      />
    );
  }
  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarLetter}>{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

export function InboxScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const me = useMe();
  const inbox = useInbox();
  const myId = me.data?.id;
  const rows = useMemo(
    () => inbox.data?.conversations ?? [],
    [inbox.data?.conversations],
  );
  const roles = me.data?.roles ?? [];
  const isPlatformAdmin = roles.includes("ADMIN") || roles.includes("OWNER");
  const [target, setTarget] = useState<InboxConversation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<InboxFilter>("all");

  const unreadMessages = inbox.data?.unreadMessages ?? 0;
  const unreadThreads = useMemo(
    () => rows.filter((row) => isUnread(row)).length,
    [rows],
  );
  const readThreads = Math.max(0, rows.length - unreadThreads);
  const filteredRows = useMemo(() => {
    if (filter === "unread") return rows.filter((row) => isUnread(row));
    if (filter === "read") return rows.filter((row) => !isUnread(row));
    return rows;
  }, [filter, rows]);

  async function confirmDelete() {
    if (!target || !token) return;
    setDeleting(true);
    try {
      await api(`/api/conversations/${target.id}`, { method: "DELETE" });
      removeConversationLocal(queryClient, token, target.id);
      setTarget(null);
      showToast("Conversation supprimée", "success");
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Suppression impossible",
        "error",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <View
      style={[
        styles.wrap,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 78 },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Messages</Text>
          {unreadMessages > 0 ? (
            <View style={styles.countPill}>
              <Text style={styles.countText}>
                {unreadMessages > 9 ? "9+" : compactCount(unreadMessages)}
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          hitSlop={8}
          onPress={() => (token ? router.push("/ai-chat" as Href) : openAuth())}
          style={styles.aiBtn}
        >
          <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
          <Text style={styles.aiBtnText}>IA Chat</Text>
        </Pressable>
      </View>
      <Text style={styles.lead}>
        {unreadMessages > 0
          ? `${compactCount(unreadMessages)} non lu${unreadMessages > 1 ? "s" : ""} · ${compactCount(readThreads)} lu${readThreads > 1 ? "s" : ""}`
          : rows.length > 0
            ? `${compactCount(readThreads)} conversation${readThreads > 1 ? "s" : ""} lue${readThreads > 1 ? "s" : ""}`
            : "Conversations protégées — les urgences restent non lues jusqu’à réponse."}
      </Text>
      {token && rows.length > 0 ? (
        <View style={styles.filterRow}>
          {(
            [
              { id: "all", label: "Tous", count: rows.length },
              { id: "unread", label: "Non lus", count: unreadThreads },
              { id: "read", label: "Lus", count: readThreads },
            ] as const
          ).map((tab) => {
            const on = filter === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setFilter(tab.id)}
                style={[styles.filterTab, on && styles.filterTabOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.filterText, on && styles.filterTextOn]}>
                  {tab.label}
                </Text>
                <Text style={[styles.filterCount, on && styles.filterCountOn]}>
                  {compactCount(tab.count)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {!token ? (
        <View style={styles.guestCenter}>
          <Ionicons name="chatbubbles-outline" size={40} color={colors.muted} />
          <Text style={styles.guestText}>
            Connecte-toi pour voir tes messages.
          </Text>
          <Pressable style={styles.cta} onPress={openAuth}>
            <Text style={styles.ctaText}>Se connecter</Text>
          </Pressable>
        </View>
      ) : inbox.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.emerald} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={36} color={colors.muted} />
          <Text style={styles.empty}>Aucune conversation pour l’instant.</Text>
        </View>
      ) : filteredRows.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
            name={
              filter === "unread" ? "mail-open-outline" : "chatbubbles-outline"
            }
            size={36}
            color={colors.muted}
          />
          <Text style={styles.empty}>
            {filter === "unread"
              ? "Aucun message non lu."
              : "Aucune conversation lue."}
          </Text>
        </View>
      ) : (
        <FlashList
          data={filteredRows}
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ThreadRow
              item={item}
              myId={myId}
              canDelete={
                item.buyer.id === myId ||
                item.shop.ownerUserId === myId ||
                isPlatformAdmin
              }
              onDelete={setTarget}
              onOpen={(row) => {
                markConversationSeenLocal(queryClient, token, row.id);
                router.push(`/messages/${row.id}` as Href);
              }}
            />
          )}
        />
      )}
      <ConfirmDialog
        open={Boolean(target)}
        title="Supprimer la conversation ?"
        message="Elle sera retirée de ta boîte de réception."
        busy={deleting}
        onCancel={() => setTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </View>
  );
}

function ThreadRow({
  item,
  myId,
  canDelete,
  onDelete,
  onOpen,
}: {
  item: InboxConversation;
  myId?: string | null;
  canDelete: boolean;
  onDelete: (item: InboxConversation) => void;
  onOpen: (item: InboxConversation) => void;
}) {
  const title = conversationTitle(item, myId);
  const last = item.messages[0];
  const unreadCount = item.unreadCount ?? 0;
  const unread = unreadCount > 0;
  const urgent = Boolean(item.urgentPending);
  const badgeLabel = unreadCount > 99 ? "99+" : compactCount(unreadCount);
  return (
    <View
      style={[
        styles.row,
        urgent && styles.rowUrgent,
        unread && !urgent && styles.rowUnread,
      ]}
    >
      <Pressable onPress={() => onOpen(item)} style={styles.rowMain}>
        <View style={styles.avatarWrap}>
          <Avatar uri={conversationAvatar(item, myId)} name={title} />
          {urgent ? (
            <View style={styles.urgentDot}>
              <Ionicons name="warning" size={10} color="#111" />
            </View>
          ) : unread ? (
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>{badgeLabel}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.rowTop}>
            <Text
              style={[styles.name, unread && styles.nameUnread]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <View style={styles.meta}>
              <Text style={styles.time}>{timeLabel(last?.createdAt)}</Text>
              {unread ? (
                <View style={styles.rowBadge}>
                  <Text style={styles.rowBadgeText}>{badgeLabel}</Text>
                </View>
              ) : null}
            </View>
          </View>
          {item.wantedRequest ? (
            <Text style={styles.ctx} numberOfLines={1}>
              Je cherche · {item.wantedRequest.title}
            </Text>
          ) : null}
          {item.product ? (
            <Text style={styles.ctx} numberOfLines={1}>
              {item.product.title}
            </Text>
          ) : null}
          <Text
            style={[
              styles.preview,
              urgent && styles.previewUrgent,
              unread && !urgent && styles.previewUnread,
            ]}
            numberOfLines={2}
          >
            {urgent ? "⚠ " : ""}
            {last?.body ?? "Nouvelle conversation"}
          </Text>
        </View>
      </Pressable>
      {canDelete ? (
        <Pressable
          onPress={() => onDelete(item)}
          hitSlop={8}
          style={styles.deleteBtn}
          accessibilityLabel="Supprimer la conversation"
        >
          <Ionicons
            name="trash-outline"
            size={16}
            color="rgba(255,255,255,0.45)"
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 18 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,87,34,0.45)",
    backgroundColor: "rgba(255,87,34,0.12)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  aiBtnText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  title: { color: "#fff", fontSize: 28, fontWeight: "800" },
  countPill: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: colors.buyStart,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  lead: { color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 12 },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  filterTab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,140,0.22)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  filterTabOn: {
    backgroundColor: "rgba(16,185,129,0.16)",
    borderColor: "rgba(16,185,129,0.45)",
  },
  filterText: {
    color: "rgba(255,255,255,0.72)",
    fontWeight: "700",
    fontSize: 13,
  },
  filterTextOn: { color: "#fff" },
  filterCount: {
    color: colors.muted,
    fontWeight: "700",
    fontSize: 11,
  },
  filterCountOn: { color: colors.emerald },
  center: { gap: 12, marginTop: 24 },
  guestCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 28,
  },
  guestText: {
    color: "rgba(255,255,255,0.72)",
    lineHeight: 22,
    textAlign: "center",
    fontSize: 15,
  },
  empty: { color: "rgba(255,255,255,0.72)", lineHeight: 22 },
  cta: {
    alignSelf: "center",
    backgroundColor: colors.emerald,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ctaText: { color: "#04281c", fontWeight: "800" },
  list: { gap: 10, paddingBottom: 20 },
  row: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 10,
    alignItems: "flex-start",
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  deleteBtn: {
    alignSelf: "center",
    padding: 6,
  },
  rowUrgent: {
    backgroundColor: "rgba(245,158,11,0.12)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.35)",
  },
  rowUnread: { borderWidth: 1, borderColor: "rgba(255,77,141,0.35)" },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#222",
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.buyStart,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { color: "#fff", fontWeight: "800", fontSize: 18 },
  avatarBadge: {
    position: "absolute",
    right: -6,
    top: -6,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    backgroundColor: "#FF2D55",
    borderWidth: 2.5,
    borderColor: "#0B0B0F",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    elevation: 4,
    shadowColor: "#FF2D55",
    shadowOpacity: 0.55,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  avatarBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 13,
  },
  rowBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: "#FF2D55",
    alignItems: "center",
    justifyContent: "center",
  },
  rowBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },
  urgentDot: {
    position: "absolute",
    right: -2,
    top: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flex: 1, color: "#fff", fontWeight: "700" },
  nameUnread: { fontWeight: "800" },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  time: { color: colors.muted, fontSize: 11 },
  ctx: { color: colors.emerald, fontWeight: "700", fontSize: 12, marginTop: 2 },
  preview: { color: colors.muted, fontSize: 13, marginTop: 4, lineHeight: 18 },
  previewUrgent: { color: "#fcd34d", fontWeight: "700" },
  previewUnread: { color: "#fff", fontWeight: "600" },
});
