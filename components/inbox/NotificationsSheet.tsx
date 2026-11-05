import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";
import { useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, mediaUrl } from "@/src/api";
import { compactCount } from "@/src/format";
import {
    conversationAvatar,
    conversationTitle,
    inboxQueryKey,
    markCommentsReadLocal,
    useInbox,
    type InboxComment,
    type InboxConversation,
} from "@/src/inbox";
import { useMe } from "@/src/me";
import { useSession } from "@/src/session";
import { colors } from "@/src/theme";

export function NotificationsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const token = useSession((state) => state.token);
  const me = useMe();
  const inbox = useInbox();
  const [tab, setTab] = useState<"messages" | "comments">("messages");
  const myId = me.data?.id;
  const conversations = inbox.data?.conversations ?? [];
  const comments = inbox.data?.comments ?? [];
  const unreadMessages = inbox.data?.unreadMessages ?? 0;
  const unreadComments = inbox.data?.unreadComments ?? 0;

  async function openComments() {
    setTab("comments");
    const unreadIds = comments.filter((row) => row.unread).map((row) => row.id);
    if (!unreadIds.length || !token) return;
    markCommentsReadLocal(queryClient, token, unreadIds);
    try {
      await api("/api/comments/read", {
        method: "POST",
        body: JSON.stringify({ commentIds: unreadIds }),
      });
    } catch {
      void queryClient.invalidateQueries({ queryKey: inboxQueryKey(token) });
    }
  }

  function openThread(id: string) {
    onClose();
    router.push(`/messages/${id}` as Href);
  }

  const badge = unreadMessages + unreadComments;

  return (
    <Modal
      visible={open}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.frame}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom) }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Notifications</Text>
            {badge > 0 ? (
              <View style={styles.countPill}>
                <Text style={styles.countText}>
                  {badge > 9 ? "9+" : compactCount(badge)}
                </Text>
              </View>
            ) : null}
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </View>
          <Text style={styles.hint}>
            Messages et commentaires — le compteur baisse dès qu’ils sont lus.
          </Text>
          <View style={styles.modeRow}>
            <Pressable
              onPress={() => setTab("messages")}
              style={[styles.mode, tab === "messages" && styles.modeOn]}
            >
              <Ionicons
                name="chatbubbles"
                size={18}
                color={tab === "messages" ? "#fff" : colors.muted}
              />
              <Text
                style={[
                  styles.modeText,
                  tab === "messages" && styles.modeTextOn,
                ]}
              >
                Messages
                {unreadMessages > 0 ? ` · ${compactCount(unreadMessages)}` : ""}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void openComments()}
              style={[styles.mode, tab === "comments" && styles.modeOn]}
            >
              <Ionicons
                name="chatbubble-ellipses"
                size={18}
                color={tab === "comments" ? "#fff" : colors.muted}
              />
              <Text
                style={[
                  styles.modeText,
                  tab === "comments" && styles.modeTextOn,
                ]}
              >
                Commentaires
                {unreadComments > 0 ? ` · ${compactCount(unreadComments)}` : ""}
              </Text>
            </Pressable>
          </View>
          <ScrollView
            style={{ maxHeight: 420 }}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
          >
            {tab === "messages" ? (
              conversations.length === 0 ? (
                <Text style={styles.empty}>Aucun message</Text>
              ) : (
                conversations
                  .slice(0, 12)
                  .map((row) => (
                    <MessageRow
                      key={row.id}
                      row={row}
                      myId={myId}
                      onPress={() => openThread(row.id)}
                    />
                  ))
              )
            ) : comments.length === 0 ? (
              <Text style={styles.empty}>Aucun commentaire</Text>
            ) : (
              comments.map((row) => <CommentRow key={row.id} row={row} />)
            )}
          </ScrollView>
          <Pressable
            onPress={() => {
              onClose();
              router.push("/messages");
            }}
          >
            <LinearGradient
              colors={[colors.buyStart, colors.buyEnd]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.pay}
            >
              <Ionicons name="chatbubbles" size={18} color="#fff" />
              <Text style={styles.payText}>Voir tous les messages</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function MessageRow({
  row,
  myId,
  onPress,
}: {
  row: InboxConversation;
  myId?: string | null;
  onPress: () => void;
}) {
  const title = conversationTitle(row, myId);
  const uri = conversationAvatar(row, myId);
  const unread = (row.unreadCount ?? 0) > 0;
  const last = row.messages[0];
  return (
    <Pressable
      onPress={onPress}
      style={[styles.item, unread && styles.itemUnread]}
    >
      {uri ? (
        <Image
          source={{ uri: mediaUrl(uri) ?? uri }}
          style={styles.avatar}
          contentFit="cover"
        />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.letter}>{title.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text
          style={[styles.name, unread && styles.nameUnread]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {row.product ? (
          <Text style={styles.ctx} numberOfLines={1}>
            {row.product.title}
          </Text>
        ) : null}
        <Text
          style={[styles.preview, unread && styles.previewUnread]}
          numberOfLines={2}
        >
          {last?.body ?? "Nouvelle conversation"}
        </Text>
      </View>
      {unread ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {(row.unreadCount ?? 0) > 9 ? "9+" : row.unreadCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function CommentRow({ row }: { row: InboxComment }) {
  return (
    <View style={styles.item}>
      <View style={styles.avatarFallback}>
        <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {row.user.name} · {row.product.title}
        </Text>
        <Text style={styles.preview} numberOfLines={2}>
          {row.body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 12,
    maxHeight: "88%",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 18,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: { color: "#fff", fontSize: 28, fontWeight: "800", flex: 1 },
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
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: -4 },
  modeRow: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  mode: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  modeOn: { backgroundColor: colors.buyStart, borderColor: colors.buyStart },
  modeText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 17,
    textAlign: "center",
  },
  modeTextOn: { color: "#fff" },
  list: { gap: 10, paddingBottom: 8 },
  empty: {
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    paddingVertical: 28,
    lineHeight: 22,
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 10,
  },
  itemUnread: { borderWidth: 1, borderColor: "rgba(255,77,141,0.35)" },
  avatar: { width: 56, height: 68, borderRadius: 10, backgroundColor: "#222" },
  avatarFallback: {
    width: 56,
    height: 68,
    borderRadius: 10,
    backgroundColor: colors.buyStart,
    alignItems: "center",
    justifyContent: "center",
  },
  letter: { color: "#fff", fontWeight: "800", fontSize: 18 },
  name: { color: "#fff", fontWeight: "700" },
  nameUnread: { fontWeight: "800" },
  ctx: { color: colors.emerald, fontWeight: "700", fontSize: 12, marginTop: 2 },
  preview: { color: colors.muted, fontSize: 13, marginTop: 4, lineHeight: 18 },
  previewUnread: { color: "#fff", fontWeight: "600" },
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
  pay: {
    borderRadius: 999,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  payText: {
    color: "#fff",
    fontWeight: "800",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 20,
  },
});
