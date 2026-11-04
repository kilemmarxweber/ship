import { onlineManager, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/api";
import { inboxQueryKey } from "@/src/offline/keys";
import { useSession } from "@/src/session";

export { inboxQueryKey };

export type InboxConversation = {
  id: string;
  updatedAt: string;
  urgentPending?: boolean;
  unreadCount?: number;
  shop: { id: string; name: string; logoUrl?: string | null };
  product?: { id: string; title: string; images: string[] } | null;
  wantedRequest?: { id: string; title: string } | null;
  buyer: { id: string; name: string; image?: string | null };
  messages: {
    body: string;
    createdAt: string;
    senderId: string;
    isUrgent?: boolean;
    requiresAck?: boolean;
  }[];
};

export type InboxComment = {
  id: string;
  body: string;
  createdAt: string;
  unread: boolean;
  user: { id: string; name: string; image: string | null };
  product: {
    id: string;
    title: string;
    images: string[];
    shop: { id: string; name: string; logoUrl: string | null };
  };
};

export type InboxSnapshot = {
  conversations: InboxConversation[];
  comments: InboxComment[];
  unreadMessages: number;
  unreadComments: number;
  urgentCount: number;
  badge: number;
};

export function sortInbox(list: InboxConversation[]) {
  return [...list].sort((a, b) => {
    const au = a.urgentPending ? 2 : (a.unreadCount ?? 0) > 0 ? 1 : 0;
    const bu = b.urgentPending ? 2 : (b.unreadCount ?? 0) > 0 ? 1 : 0;
    if (au !== bu) return bu - au;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function totals(conversations: InboxConversation[], unreadComments: number) {
  const unreadMessages = conversations.reduce(
    (sum, row) => sum + (row.unreadCount ?? 0),
    0,
  );
  const urgentCount = conversations.filter((row) => row.urgentPending).length;
  return {
    unreadMessages,
    urgentCount,
    badge: unreadMessages + unreadComments,
  };
}

export async function fetchInbox(): Promise<InboxSnapshot> {
  const [conv, summary] = await Promise.all([
    api<{ conversations?: InboxConversation[] }>("/api/conversations"),
    api<{ unreadComments?: number; comments?: InboxComment[] }>(
      "/api/inbox/summary",
    ).catch(() => ({ unreadComments: 0, comments: [] })),
  ]);
  const conversations = sortInbox(conv.conversations ?? []);
  const unreadComments = summary.unreadComments ?? 0;
  const snapshot = {
    conversations,
    comments: summary.comments ?? [],
    unreadComments,
    ...totals(conversations, unreadComments),
  };
  const token = useSession.getState().token;
  void import("@/src/offline/persist").then(({ persistInbox }) => {
    persistInbox(token, snapshot);
  });
  return snapshot;
}

export function useInbox() {
  const token = useSession((state) => state.token);
  return useQuery({
    queryKey: inboxQueryKey(token),
    enabled: Boolean(token),
    refetchInterval: () => (onlineManager.isOnline() ? 25_000 : false),
    staleTime: 30_000,
    gcTime: 24 * 60 * 60 * 1000,
    networkMode: "offlineFirst",
    queryFn: fetchInbox,
  });
}

export function markConversationSeenLocal(
  queryClient: ReturnType<typeof useQueryClient>,
  token: string | null,
  conversationId: string,
) {
  queryClient.setQueryData<InboxSnapshot>(inboxQueryKey(token), (current) => {
    if (!current) return current;
    const conversations = current.conversations.map((row) => {
      if (row.id !== conversationId) return row;
      if (row.urgentPending) return row;
      return { ...row, unreadCount: 0 };
    });
    return {
      ...current,
      conversations,
      ...totals(conversations, current.unreadComments),
    };
  });
}

export function markCommentsReadLocal(
  queryClient: ReturnType<typeof useQueryClient>,
  token: string | null,
  commentIds: string[],
) {
  const ids = new Set(commentIds);
  queryClient.setQueryData<InboxSnapshot>(inboxQueryKey(token), (current) => {
    if (!current) return current;
    let dropped = 0;
    const comments = current.comments.map((row) => {
      if (!ids.has(row.id) || !row.unread) return row;
      dropped += 1;
      return { ...row, unread: false };
    });
    const unreadComments = Math.max(0, current.unreadComments - dropped);
    return {
      ...current,
      comments,
      unreadComments,
      ...totals(current.conversations, unreadComments),
    };
  });
}

export function conversationTitle(
  row: InboxConversation,
  myId: string | null | undefined,
) {
  if (!myId) return row.shop.name;
  return row.buyer.id === myId ? row.shop.name : row.buyer.name;
}

export function conversationAvatar(
  row: InboxConversation,
  myId: string | null | undefined,
) {
  if (myId && row.buyer.id === myId) return row.shop.logoUrl ?? null;
  return row.buyer.image ?? null;
}
