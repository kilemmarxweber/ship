import type { QueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";

import { remoteMediaUrl } from "@/src/api";
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
    discoverSnapKey,
    feedQueryKey,
    feedSnapKey,
    inboxQueryKey,
    inboxSnapKey,
    threadSnapKey,
} from "@/src/offline/keys";
import { enqueueMediaCache } from "@/src/offline/media-cache";
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

function prefetchFeedAvMedia(products: CompactProduct[]) {
  try {
    const posters = products
      .map((row) => remoteMediaUrl(row.poster))
      .filter((url): url is string => Boolean(url));
    if (posters.length) void Image.prefetch(posters);

    // Absolute URLs only — media_cache keys must match playableMediaUrl lookups.
    enqueueMediaCache(
      products.flatMap((row) => {
        const video = remoteMediaUrl(row.videoUrl);
        const audio = remoteMediaUrl(row.audioUrl);
        return [
          video ? { url: video, kind: "video" as const } : null,
          audio ? { url: audio, kind: "audio" as const } : null,
        ].filter((item): item is { url: string; kind: "video" | "audio" } =>
          Boolean(item?.url),
        );
      }),
    );
  } catch {
    /* never crash the UI while warming offline media */
  }
}

export function persistFeed(
  token: string | null | undefined,
  pages: FeedPage[] | undefined,
  tab: "foryou" | "following" = "foryou",
) {
  later(feedSnapKey(token, tab), () => {
    const compact = compactFeedPages(pages);
    snapshotSet(feedSnapKey(token, tab), compact);
    prefetchFeedAvMedia(compact.products);
  });
}

export function persistDiscover(
  token: string | null | undefined,
  pages: FeedPage[] | undefined,
) {
  later(discoverSnapKey(token), () => {
    const compact = compactFeedPages(pages);
    snapshotSet(discoverSnapKey(token), compact);
    prefetchFeedAvMedia(compact.products);
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
  for (const tab of ["foryou", "following"] as const) {
    const feed = snapshotGet<{ products?: CompactProduct[] }>(
      feedSnapKey(token, tab),
    );
    if (!feed?.products?.length) continue;
    const existing = queryClient.getQueryData(feedQueryKey(token, tab));
    // Keep live online pages if already hydrated; only seed empty caches.
    if (!existing) {
      queryClient.setQueryData(feedQueryKey(token, tab), expandFeedPages(feed));
    }
    prefetchFeedAvMedia(feed.products);
  }

  // Legacy snap key (pre-tab) → foryou guest/user
  const legacy = snapshotGet<{ products?: CompactProduct[] }>(
    `feed.foryou:${token ?? "guest"}`,
  );
  if (legacy?.products?.length) {
    const key = feedQueryKey(token, "foryou");
    if (!queryClient.getQueryData(key)) {
      queryClient.setQueryData(key, expandFeedPages(legacy));
    }
  }

  const discover = snapshotGet<{ products?: CompactProduct[] }>(
    discoverSnapKey(token),
  );
  if (discover?.products?.length) {
    const key = ["discover", "", null, token ?? "guest"] as const;
    // Discover query key includes search/category — seed the default empty search.
    if (!queryClient.getQueryData(key)) {
      queryClient.setQueryData(key, expandFeedPages(discover));
    }
    prefetchFeedAvMedia(discover.products);
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
