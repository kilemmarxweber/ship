import { Ionicons } from "@expo/vector-icons";
import { onlineManager, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    type TextInput as TextInputType,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Face } from "@/components/ui/Face";
import { IconBackButton } from "@/components/ui/IconBackButton";
import { api } from "@/src/api";
import {
    inboxQueryKey,
    markConversationSeenLocal,
    removeConversationLocal,
} from "@/src/inbox";
import { useMe } from "@/src/me";
import { snapshotGet } from "@/src/offline/db";
import { threadSnapKey } from "@/src/offline/keys";
import { persistThread } from "@/src/offline/persist";
import { requestOrQueue } from "@/src/offline/writes";
import { usePrefs } from "@/src/prefs";
import { useSession } from "@/src/session";
import { useTabBarMetrics } from "@/src/tab-bar-metrics";
import { HAIRLINE } from "@/src/theme";
import { showToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";

const SENT = "#0A84FF";
const INCOMING_DARK = "#3A3A3C";
const INCOMING_LIGHT = "#E5E5EA";
const CANVAS_DARK = "#000000";
const STAMP = "#8E8E93";

const WEEKDAYS = [
  "DIM.",
  "LUN.",
  "MAR.",
  "MER.",
  "JEU.",
  "VEN.",
  "SAM.",
] as const;
const MONTHS = [
  "JANV.",
  "FÉVR.",
  "MARS",
  "AVR.",
  "MAI",
  "JUIN",
  "JUIL.",
  "AOÛT",
  "SEPT.",
  "OCT.",
  "NOV.",
  "DÉC.",
] as const;

function clock(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function chatStamp(iso: string, now = new Date()) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = clock(date);
  const start = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const dayGap = Math.round((start(now) - start(date)) / 86_400_000);
  if (dayGap >= 0 && dayGap < 7) return `${WEEKDAYS[date.getDay()]}, ${time}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${time}`;
}

function showChatStamp(current: string, previous?: string) {
  if (!previous) return true;
  const a = new Date(current).getTime();
  const b = new Date(previous).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
  if (a - b >= 30 * 60 * 1000) return true;
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() !== db.getFullYear() ||
    da.getMonth() !== db.getMonth() ||
    da.getDate() !== db.getDate()
  );
}

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
  shop: {
    id: string;
    name: string;
    ownerUserId?: string | null;
    logoUrl?: string | null;
  };
  product: { id: string; title: string } | null;
  wantedRequest?: { id: string; title: string } | null;
  buyer: { id: string; name: string; image?: string | null };
};

export function ThreadScreen({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarMetrics();
  const c = useColors();
  const dark = usePrefs((state) => state.theme) !== "light";
  const canvas = dark ? CANVAS_DARK : "#FFFFFF";
  const incomingBg = dark ? INCOMING_DARK : INCOMING_LIGHT;
  const incomingText = dark ? "#FFFFFF" : "#111111";
  const queryClient = useQueryClient();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const me = useMe();
  const myId = me.data?.id;
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInputType>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [keyboard, setKeyboard] = useState(0);
  const [messageToDelete, setMessageToDelete] = useState<ChatMessage | null>(
    null,
  );
  const [conversationToDelete, setConversationToDelete] = useState(false);
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
      const focusTimer = setTimeout(() => inputRef.current?.focus(), 280);
      const scrollTimer = setTimeout(
        () => scrollRef.current?.scrollToEnd({ animated: false }),
        120,
      );
      return () => {
        clearTimeout(focusTimer);
        clearTimeout(scrollTimer);
      };
    }, [id, queryClient, token]),
  );

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) => {
        setKeyboard(event.endCoordinates.height);
        requestAnimationFrame(() =>
          scrollRef.current?.scrollToEnd({ animated: true }),
        );
      },
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboard(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const conversation = thread.data?.conversation ?? null;
  const remoteMessages = thread.data?.messages ?? [];
  const messages = localMessages ?? remoteMessages;
  const issues = thread.data?.openIssues ?? [];

  useEffect(() => {
    if (!messages.length) return;
    const timer = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      60,
    );
    return () => clearTimeout(timer);
  }, [messages.length]);

  const dockPad =
    keyboard > 0
      ? Math.max(10, 8)
      : tabBar.barBody + Math.max(insets.bottom, 8) + 8;

  const isBuyer = conversation?.buyer.id === myId;
  const title = isBuyer ? conversation?.shop.name : conversation?.buyer.name;
  const hasUrgent = messages.some((row) => row.isUrgent && row.requiresAck);

  const roles = me.data?.roles ?? [];
  const isPlatformAdmin = roles.includes("ADMIN") || roles.includes("OWNER");

  function canDeleteMessage(row: ChatMessage) {
    if (row.id.startsWith("temp:")) return false;
    return row.senderId === myId || isPlatformAdmin;
  }

  function canDeleteConversation() {
    if (!conversation || !myId) return false;
    return (
      conversation.buyer.id === myId ||
      conversation.shop.ownerUserId === myId ||
      isPlatformAdmin
    );
  }

  async function deleteMessage(row: ChatMessage) {
    if (!token) return;
    setDeleting(true);
    const next = (localMessages ?? remoteMessages).filter(
      (item) => item.id !== row.id,
    );
    try {
      await api(`/api/conversations/${id}/messages/${row.id}`, {
        method: "DELETE",
      });
      setLocalMessages(next);
      persistThread(id, next);
      queryClient.setQueryData(
        ["conversation", id, token],
        (current: unknown) =>
          current && typeof current === "object"
            ? { ...(current as Record<string, unknown>), messages: next }
            : current,
      );
      setMessageToDelete(null);
      markConversationSeenLocal(queryClient, token, id);
      await queryClient.invalidateQueries({ queryKey: inboxQueryKey(token) });
      await thread.refetch();
      setLocalMessages(null);
      showToast("Message supprimé", "success");
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Suppression impossible",
        "error",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function deleteConversation() {
    if (!token) return;
    setDeleting(true);
    try {
      await api(`/api/conversations/${id}`, { method: "DELETE" });
      removeConversationLocal(queryClient, token, id);
      queryClient.removeQueries({ queryKey: ["conversation", id, token] });
      persistThread(id, []);
      setConversationToDelete(false);
      showToast("Conversation supprimée", "success");
      router.replace("/messages" as Href);
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Suppression impossible",
        "error",
      );
    } finally {
      setDeleting(false);
    }
  }

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
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        scrollRef.current?.scrollToEnd({ animated: true });
      });
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

  const peerName =
    (isBuyer ? conversation?.shop.name : conversation?.buyer.name) || "…";
  const peerImage = isBuyer
    ? conversation?.shop.logoUrl
    : conversation?.buyer.image;

  if (!token) {
    return (
      <View
        style={[
          styles.wrap,
          { paddingTop: insets.top + 4, backgroundColor: canvas },
        ]}
      >
        <View style={styles.header}>
          <IconBackButton
            color={SENT}
            onPress={() => router.replace("/messages" as Href)}
          />
          <Text style={[styles.title, { color: c.text }]}>Messages</Text>
        </View>
        <View style={styles.guestCenter}>
          <Ionicons name="chatbubbles-outline" size={40} color={c.textMuted} />
          <Text style={[styles.guestText, { color: c.textMuted }]}>
            Connecte-toi pour écrire.
          </Text>
          <Pressable
            style={[styles.loginBtn, { backgroundColor: c.emerald }]}
            onPress={openAuth}
          >
            <Text
              style={[styles.loginText, { color: dark ? "#04281c" : "#fff" }]}
            >
              Se connecter
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[
        styles.wrap,
        { paddingTop: insets.top + 4, backgroundColor: canvas },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
    >
      <View style={styles.header}>
        <IconBackButton
          color={SENT}
          onPress={() => router.replace("/messages" as Href)}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.title, { color: dark ? "#fff" : c.text }]}
            numberOfLines={1}
          >
            {title ?? "Conversation"}
          </Text>
          {conversation?.wantedRequest ? (
            <Text
              style={[styles.sub, { color: c.textMuted }]}
              numberOfLines={1}
            >
              Je cherche · {conversation.wantedRequest.title}
            </Text>
          ) : conversation?.product ? (
            <Text
              style={[styles.sub, { color: c.textMuted }]}
              numberOfLines={1}
            >
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
        {conversation && canDeleteConversation() ? (
          <Pressable
            onPress={() => setConversationToDelete(true)}
            hitSlop={8}
            style={styles.headerAction}
            accessibilityLabel="Supprimer la conversation"
          >
            <Ionicons name="trash-outline" size={18} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {!isBuyer && issues.length > 0 ? (
        <View style={styles.issues}>
          {issues.map((issue) => (
            <View key={issue.id} style={styles.issue}>
              <Text style={styles.issueTitle}>
                {ISSUE_TYPE_LABELS[issue.type] ?? issue.type}
              </Text>
              <Text style={[styles.issueBody, { color: c.textMuted }]}>
                {issue.description}
              </Text>
              <View style={styles.issueRow}>
                <Pressable
                  disabled={acting}
                  onPress={() => void resolveIssue(issue, "confirm_change")}
                >
                  <Text style={[styles.issueAct, { color: c.emerald }]}>
                    Confirmer
                  </Text>
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
          <ActivityIndicator color={c.emerald} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.threadScroll}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentInsetAdjustmentBehavior="automatic"
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: false })
          }
        >
          {messages.map((row, index) => {
            const mine = row.senderId === myId;
            const urgent = Boolean(row.isUrgent);
            const previous = messages[index - 1]?.createdAt;
            const stamped = showChatStamp(row.createdAt, previous);
            const deletable = canDeleteMessage(row);
            return (
              <View key={row.id} style={{ marginTop: stamped ? 18 : 6 }}>
                {stamped ? (
                  <Text style={styles.stamp} selectable>
                    {chatStamp(row.createdAt)}
                  </Text>
                ) : null}
                <View style={[styles.line, mine && styles.lineMine]}>
                  {mine ? null : (
                    <Face
                      uri={peerImage}
                      name={peerName}
                      size={30}
                      fallbackColor="#636366"
                    />
                  )}
                  <Pressable
                    disabled={!deletable}
                    delayLongPress={380}
                    onLongPress={
                      deletable ? () => setMessageToDelete(row) : undefined
                    }
                    accessibilityHint={
                      deletable ? "Appui long pour supprimer" : undefined
                    }
                    style={({ pressed }) => [
                      styles.bubble,
                      {
                        backgroundColor: urgent
                          ? "rgba(245,158,11,0.2)"
                          : mine
                            ? SENT
                            : incomingBg,
                        opacity: pressed && deletable ? 0.82 : 1,
                      },
                      urgent && styles.bubbleUrgent,
                    ]}
                  >
                    {urgent ? (
                      <Text style={styles.urgentFlag}>
                        Urgence{row.requiresAck ? " · non lu" : ""}
                      </Text>
                    ) : null}
                    <Text
                      selectable
                      style={[
                        styles.body,
                        {
                          color: urgent
                            ? dark
                              ? "#FFFFFF"
                              : "#1C1C1E"
                            : mine
                              ? "#FFFFFF"
                              : incomingText,
                        },
                      ]}
                    >
                      {row.body}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <View
        style={[
          styles.dock,
          {
            paddingBottom: dockPad,
            backgroundColor: canvas,
            borderTopColor: dark ? "rgba(255,255,255,0.08)" : HAIRLINE,
          },
        ]}
      >
        <View style={styles.composer}>
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            placeholder={
              !isBuyer && hasUrgent
                ? "Répondre pour acquitter l’urgence"
                : "Message"
            }
            placeholderTextColor={dark ? "rgba(255,255,255,0.35)" : "#8E8E93"}
            style={[
              styles.input,
              {
                backgroundColor: dark ? "#1C1C1E" : "#F2F2F7",
                color: dark ? "#fff" : c.text,
              },
            ]}
            multiline
            textAlignVertical="center"
            autoFocus
            blurOnSubmit={false}
          />
          <Pressable
            onPress={() => void send()}
            disabled={sending || !draft.trim()}
            accessibilityRole="button"
            accessibilityLabel="Envoyer"
            style={[
              styles.sendBtn,
              { opacity: sending || !draft.trim() ? 0.4 : 1 },
            ]}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>

      <ConfirmDialog
        open={Boolean(messageToDelete)}
        title="Supprimer ce message ?"
        message="Cette action est définitive pour tous les participants."
        busy={deleting}
        onCancel={() => setMessageToDelete(null)}
        onConfirm={() => {
          if (messageToDelete) void deleteMessage(messageToDelete);
        }}
      />
      <ConfirmDialog
        open={conversationToDelete}
        title="Supprimer la conversation ?"
        message="Elle sera retirée de ta boîte de réception."
        busy={deleting}
        onCancel={() => setConversationToDelete(false)}
        onConfirm={() => void deleteConversation()}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  title: { fontSize: 17, fontWeight: "700" },
  sub: { fontWeight: "500", fontSize: 12, marginTop: 1 },
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
  headerAction: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  issues: { gap: 8, marginBottom: 10 },
  issue: {
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.28)",
    backgroundColor: "rgba(245,158,11,0.1)",
    padding: 14,
    gap: 6,
  },
  issueTitle: { color: "#fcd34d", fontWeight: "800", fontSize: 12 },
  issueBody: { fontSize: 12, lineHeight: 18 },
  issueRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  issueAct: { fontWeight: "800" },
  issueGhost: { color: "#ff8a8a", fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  threadScroll: { flex: 1 },
  guestCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 28,
  },
  guestText: {
    lineHeight: 22,
    textAlign: "center",
    fontSize: 15,
  },
  loginBtn: {
    alignSelf: "center",
    backgroundColor: "#00D68F",
    borderRadius: 14,
    borderCurve: "continuous",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  loginText: { fontWeight: "800" },
  thread: { flexGrow: 1, paddingBottom: 16, paddingTop: 4 },
  line: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lineMine: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  bubbleUrgent: {
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.45)",
  },
  urgentFlag: {
    color: "#fcd34d",
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 4,
  },
  body: { fontSize: 16, lineHeight: 21, fontWeight: "400" },
  stamp: {
    color: STAMP,
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  dock: {
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composer: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    minHeight: 34,
    maxHeight: 88,
    borderRadius: 17,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SENT,
    alignItems: "center",
    justifyContent: "center",
  },
});
