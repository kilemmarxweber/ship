import { Ionicons } from "@expo/vector-icons";
import { onlineManager, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { inboxQueryKey, markConversationSeenLocal } from "@/src/inbox";
import { useMe } from "@/src/me";
import { snapshotGet } from "@/src/offline/db";
import { threadSnapKey } from "@/src/offline/keys";
import { persistThread } from "@/src/offline/persist";
import { requestOrQueue } from "@/src/offline/writes";
import { useSession } from "@/src/session";
import { colors } from "@/src/theme";
import { showToast } from "@/src/toast";

const ISSUE_TYPE_LABELS: Record<string, string> = {
  WRONG_SIZE: "Mauvaise taille",
  WRONG_COLOR: "Mauvaise couleur",
  DEFECT: "Produit défectueux",
  WRONG_PRODUCT: "Mauvais produit",
  OTHER: "Autre problème",
};

type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  isUrgent?: boolean;
  requiresAck?: boolean;
  sender: { id: string; name: string };
};

type OpenIssue = {
  id: string;
  orderId: string;
  type: string;
  description: string;
  status: string;
};

type Conversation = {
  id: string;
  shop: { id: string; name: string };
  product: { id: string; title: string } | null;
  wantedRequest?: { id: string; title: string } | null;
  buyer: { id: string; name: string };
};

export function ThreadScreen({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const me = useMe();
  const myId = me.data?.id;
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const [localMessages, setLocalMessages] = useState<ChatMessage[] | null>(
    null,
  );

  const thread = useQuery({
    queryKey: ["conversation", id, token ?? "guest"],
    enabled: Boolean(token && id),
    staleTime: 30_000,
    gcTime: 24 * 60 * 60 * 1000,
    networkMode: "offlineFirst",
    refetchInterval: () => (onlineManager.isOnline() ? 8_000 : false),
    placeholderData: () => {
      const messages = snapshotGet<ChatMessage[]>(threadSnapKey(id));
      return messages?.length ? { messages } : undefined;
    },
    queryFn: async () => {
      const data = await api<{
        conversation?: Conversation;
        messages?: ChatMessage[];
        openIssues?: OpenIssue[];
      }>(`/api/conversations/${id}`);
      if (data.messages) persistThread(id, data.messages);
      return data;
    },
  });

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      markConversationSeenLocal(queryClient, token, id);
      void queryClient.invalidateQueries({ queryKey: inboxQueryKey(token) });
    }, [id, queryClient, token]),
  );

  const conversation = thread.data?.conversation ?? null;
  const remoteMessages = thread.data?.messages ?? [];
  const messages = localMessages ?? remoteMessages;
  const issues = thread.data?.openIssues ?? [];

  const isBuyer = conversation?.buyer.id === myId;
  const title = isBuyer ? conversation?.shop.name : conversation?.buyer.name;
  const hasUrgent = messages.some((row) => row.isUrgent && row.requiresAck);

  async function send() {
    const text = draft.trim();
    if (!text || sending || !token) return;
    const tempId = `temp:${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      body: text,
      createdAt: new Date().toISOString(),
      senderId: myId ?? "me",
      sender: { id: myId ?? "me", name: "Moi" },
    };
    setDraft("");
    setSending(true);
    setLocalMessages([...(localMessages ?? remoteMessages), optimistic]);
    try {
      const result = await requestOrQueue<{ message?: ChatMessage }>({
        kind: "message",
        path: `/api/conversations/${id}`,
        method: "POST",
        body: { body: text },
      });
      if (result.queued) {
        persistThread(id, [...(localMessages ?? remoteMessages), optimistic]);
        return;
      }
      if (!result.data.message) throw new Error("Envoi impossible");
      setLocalMessages((current) =>
        (current ?? []).map((row) =>
          row.id === tempId ? result.data.message! : row,
        ),
      );
      persistThread(id, [
        ...(localMessages ?? remoteMessages).filter((row) => row.id !== tempId),
        result.data.message,
      ]);
      markConversationSeenLocal(queryClient, token, id);
      await queryClient.invalidateQueries({ queryKey: inboxQueryKey(token) });
      await thread.refetch();
      setLocalMessages(null);
    } catch (cause) {
      setLocalMessages((current) =>
        (current ?? []).filter((row) => row.id !== tempId),
      );
      setDraft(text);
      showToast(
        cause instanceof Error ? cause.message : "Envoi impossible",
        "error",
      );
    } finally {
      setSending(false);
    }
  }

  async function resolveIssue(
    issue: OpenIssue,
    action: "confirm_change" | "reject" | "resolve",
  ) {
    setActing(true);
    try {
      await api(`/api/orders/${issue.orderId}/issues/${issue.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      showToast(
        action === "confirm_change"
          ? "Changement confirmé"
          : action === "reject"
            ? "Signalement refusé"
            : "Signalement clôturé",
        "success",
      );
      await thread.refetch();
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Action impossible",
        "error",
      );
    } finally {
      setActing(false);
    }
  }

  if (!token) {
    return (
      <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
          <Text style={styles.title}>Messages</Text>
        </View>
        <View style={styles.guestCenter}>
          <Ionicons
            name="chatbubbles-outline"
            size={40}
            color="rgba(255,255,255,0.45)"
          />
          <Text style={styles.guestText}>Connecte-toi pour écrire.</Text>
          <Pressable style={styles.loginBtn} onPress={openAuth}>
            <Text style={styles.loginText}>Se connecter</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.wrap, { paddingTop: insets.top + 12 }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title ?? "Conversation"}
          </Text>
          {conversation?.wantedRequest ? (
            <Text style={styles.sub} numberOfLines={1}>
              Je cherche · {conversation.wantedRequest.title}
            </Text>
          ) : conversation?.product ? (
            <Text style={styles.sub} numberOfLines={1}>
              {conversation.product.title}
            </Text>
          ) : null}
        </View>
        {hasUrgent ? (
          <View style={styles.urgentPill}>
            <Ionicons name="warning" size={12} color="#fcd34d" />
            <Text style={styles.urgentText}>Urgent</Text>
          </View>
        ) : null}
      </View>

      {!isBuyer && issues.length > 0 ? (
        <View style={styles.issues}>
          {issues.map((issue) => (
            <View key={issue.id} style={styles.issue}>
              <Text style={styles.issueTitle}>
                {ISSUE_TYPE_LABELS[issue.type] ?? issue.type}
              </Text>
              <Text style={styles.issueBody}>{issue.description}</Text>
              <View style={styles.issueRow}>
                <Pressable
                  disabled={acting}
                  onPress={() => void resolveIssue(issue, "confirm_change")}
                >
                  <Text style={styles.issueAct}>Confirmer</Text>
                </Pressable>
                <Pressable
                  disabled={acting}
                  onPress={() => void resolveIssue(issue, "resolve")}
                >
                  <Text style={styles.issueGhost}>Clôturer</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {thread.isLoading && !messages.length ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.emerald} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((row) => {
            const mine = row.senderId === myId;
            const urgent = Boolean(row.isUrgent);
            return (
              <View
                key={row.id}
                style={[styles.bubbleWrap, mine && styles.bubbleWrapMine]}
              >
                <View
                  style={[
                    styles.bubble,
                    urgent && styles.bubbleUrgent,
                    mine && !urgent && styles.bubbleMine,
                    !mine && !urgent && styles.bubbleTheirs,
                  ]}
                >
                  {urgent ? (
                    <Text style={styles.urgentFlag}>
                      Urgence{row.requiresAck ? " · non lu" : ""}
                    </Text>
                  ) : null}
                  <Text style={styles.body}>{row.body}</Text>
                  <Text style={styles.stamp}>
                    {new Date(row.createdAt).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <View
        style={[
          styles.dock,
          { paddingBottom: Math.max(12, insets.bottom + 8) },
        ]}
      >
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={
              !isBuyer && hasUrgent
                ? "Répondre pour acquitter l’urgence"
                : "Écrire un message"
            }
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.input}
            multiline
          />
          <Pressable
            onPress={() => void send()}
            disabled={sending || !draft.trim()}
            style={sending || !draft.trim() ? { opacity: 0.45 } : undefined}
          >
            <LinearGradient
              colors={[colors.buyStart, colors.buyEnd]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.sendBtn}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="send" size={16} color="#fff" />
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 18 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  sub: { color: colors.emerald, fontWeight: "700", fontSize: 12, marginTop: 2 },
  urgentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245,158,11,0.2)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  urgentText: { color: "#fcd34d", fontSize: 10, fontWeight: "800" },
  issues: { gap: 8, marginBottom: 10 },
  issue: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.28)",
    backgroundColor: "rgba(0,0,0,0.28)",
    padding: 14,
    gap: 6,
  },
  issueTitle: { color: "#fcd34d", fontWeight: "800", fontSize: 12 },
  issueBody: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  issueRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  issueAct: { color: colors.emerald, fontWeight: "800" },
  issueGhost: { color: "#ff8a8a", fontWeight: "700" },
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
  muted: { color: "rgba(255,255,255,0.72)", lineHeight: 22 },
  loginBtn: {
    alignSelf: "center",
    backgroundColor: colors.emerald,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  loginText: { color: "#04281c", fontWeight: "800" },
  thread: { gap: 10, paddingBottom: 20 },
  bubbleWrap: { alignItems: "flex-start" },
  bubbleWrapMine: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "82%",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bubbleMine: { backgroundColor: colors.buyStart },
  bubbleTheirs: { backgroundColor: "rgba(255,255,255,0.06)" },
  bubbleUrgent: {
    backgroundColor: "rgba(245,158,11,0.16)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.45)",
  },
  urgentFlag: {
    color: "#fcd34d",
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 4,
  },
  body: { color: "#fff", lineHeight: 20, fontWeight: "600" },
  stamp: { color: "rgba(255,255,255,0.55)", fontSize: 10, marginTop: 4 },
  dock: {
    paddingTop: 10,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
    backgroundColor: colors.background,
  },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});
