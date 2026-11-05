import type { QueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";

import { parseCart, type CartPayload } from "@/src/cart";
import { cartQueryKey } from "@/src/cart-store";
import type { InboxSnapshot } from "@/src/inbox";
import {
    compactCart,
    compactComments,
    compactFeedPages,
    compactInbox,
    compactThread,
    expandCart,
    expandFeedPages,
    expandInbox,
    type CompactCartLine,
    type CompactInbox,
    type CompactProduct,
} from "@/src/offline/compact";
import { snapshotGet, snapshotSet } from "@/src/offline/db";
import {
    cartSnapKey,
    commentsSnapKey,
    feedQueryKey,
    feedSnapKey,
    inboxQueryKey,
    inboxSnapKey,
    threadSnapKey,
} from "@/src/offline/keys";
import type { CommentItem, FeedPage } from "@/src/types";

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function later(key: string, write: () => void) {
  const prev = timers.get(key);
  if (prev) clearTimeout(prev);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      try {
        write();
      } catch {
        /* ignore corrupt writes */
      }
    }, 450),
  );
}

export function persistFeed(
  token: string | null | undefined,
  pages: FeedPage[] | undefined,
) {
  later(feedSnapKey(token), () => {
    const compact = compactFeedPages(pages);
    snapshotSet(feedSnapKey(token), compact);
    const posters = compact.products
      .map((row) => row.poster)
      .filter((url): url is string => Boolean(url));
    if (posters.length) void Image.prefetch(posters);
  });
}

export function persistCart(
  token: string | null | undefined,
  payload: CartPayload,
) {
  later(cartSnapKey(token), () => {
    snapshotSet(cartSnapKey(token), compactCart(payload));
  });
}

export function persistInbox(
  token: string | null | undefined,
  snapshot: InboxSnapshot,
) {
  later(inboxSnapKey(token), () => {
    snapshotSet(inboxSnapKey(token), compactInbox(snapshot));
  });
}

export function persistComments(productId: string, items: CommentItem[]) {
  later(commentsSnapKey(productId), () => {
    snapshotSet(commentsSnapKey(productId), compactComments(items));
  });
}

export function persistThread(
  id: string,
  messages: {
    id: string;
    body: string;
    createdAt: string;
    senderId: string;
    sender?: { id: string; name: string };
  }[],
) {
  later(threadSnapKey(id), () => {
    snapshotSet(threadSnapKey(id), compactThread(messages));
  });
}

export function injectSnapshots(
  queryClient: QueryClient,
  token: string | null,
) {
  const feed = snapshotGet<{ products?: CompactProduct[] }>(feedSnapKey(token));
  if (feed?.products?.length) {
    queryClient.setQueryData(feedQueryKey(token), expandFeedPages(feed));
  }
  const cart = snapshotGet<CompactCartLine[]>(cartSnapKey(token));
  if (cart) {
    const payload = expandCart(cart);
    queryClient.setQueryData(cartQueryKey(token), {
      items: payload.items,
      totalCents: payload.totalCents,
      count: payload.count,
    });
  }
  const inbox = snapshotGet<CompactInbox>(inboxSnapKey(token));
  const expanded = expandInbox(inbox);
  if (expanded) {
    queryClient.setQueryData(inboxQueryKey(token), expanded);
  }
}

export function cartFromCache(token: string | null | undefined) {
  const cart = snapshotGet<CompactCartLine[]>(cartSnapKey(token));
  return cart ? expandCart(cart) : parseCart({});
}

export function writeCartCache(
  queryClient: QueryClient,
  token: string | null | undefined,
  payload: CartPayload,
) {
  queryClient.setQueryData(cartQueryKey(token), {
    items: payload.items,
    totalCents: payload.totalCents,
    count: payload.count,
  });
  persistCart(token, payload);
}
