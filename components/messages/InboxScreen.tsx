import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mediaUrl } from "@/src/api";
import { compactCount } from "@/src/format";
import {
    conversationAvatar,
    conversationTitle,
    useInbox,
    type InboxConversation,
} from "@/src/inbox";
import { useMe } from "@/src/me";
import { useSession } from "@/src/session";
import { colors } from "@/src/theme";

function timeLabel(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const me = useMe();
  const inbox = useInbox();
  const myId = me.data?.id;
  const rows = inbox.data?.conversations ?? [];

  const unread = inbox.data?.unreadMessages ?? 0;

  return (
    <View
      style={[
        styles.wrap,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 78 },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        {unread > 0 ? (
          <View style={styles.countPill}>
            <Text style={styles.countText}>
              {unread > 9 ? "9+" : compactCount(unread)}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.lead}>
        Conversations protégées — les urgences restent non lues jusqu’à réponse.
      </Text>
      {!token ? (
        <View style={styles.center}>
          <Text style={styles.empty}>Connecte-toi pour voir tes messages.</Text>
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
      ) : (
        <FlashList
          data={rows}
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ThreadRow item={item} myId={myId} />}
        />
      )}
    </View>
  );
}

function ThreadRow({
  item,
  myId,
}: {
  item: InboxConversation;
  myId?: string | null;
}) {
  const title = conversationTitle(item, myId);
  const last = item.messages[0];
  const unread = (item.unreadCount ?? 0) > 0;
  const urgent = Boolean(item.urgentPending);
  return (
    <Pressable
      onPress={() => router.push(`/messages/${item.id}` as Href)}
      style={[
        styles.row,
        urgent && styles.rowUrgent,
        unread && !urgent && styles.rowUnread,
      ]}
    >
      <View>
        <Avatar uri={conversationAvatar(item, myId)} name={title} />
        {urgent ? (
          <View style={styles.urgentDot}>
            <Ionicons name="warning" size={10} color="#111" />
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
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {(item.unreadCount ?? 0) > 9
                    ? "9+"
                    : compactCount(item.unreadCount ?? 0)}
                </Text>
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
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 18 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
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
  lead: { color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 14 },
  center: { gap: 12, marginTop: 24 },
  empty: { color: "rgba(255,255,255,0.72)", lineHeight: 22 },
  cta: {
    alignSelf: "flex-start",
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
  rowUrgent: {
    backgroundColor: "rgba(245,158,11,0.12)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.35)",
  },
  rowUnread: { borderWidth: 1, borderColor: "rgba(255,77,141,0.35)" },
  avatar: { width: 56, height: 68, borderRadius: 10, backgroundColor: "#222" },
  avatarFallback: {
    width: 56,
    height: 68,
    borderRadius: 10,
    backgroundColor: colors.buyStart,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { color: "#fff", fontWeight: "800", fontSize: 18 },
  urgentDot: {
    position: "absolute",
    right: -4,
    top: -4,
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
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.buyStart,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  ctx: { color: colors.emerald, fontWeight: "700", fontSize: 12, marginTop: 2 },
  preview: { color: colors.muted, fontSize: 13, marginTop: 4, lineHeight: 18 },
  previewUrgent: { color: "#fcd34d", fontWeight: "700" },
  previewUnread: { color: "#fff", fontWeight: "600" },
});
