import { onlineManager, type QueryClient } from "@tanstack/react-query";
import { AppState, type AppStateStatus } from "react-native";

import { api } from "@/src/api";
import { kvSet } from "@/src/offline/db";
import { isOnline, watchNetwork } from "@/src/offline/network";
import { drainOutbox } from "@/src/offline/outbox";
import { persistDiscover, persistFeed } from "@/src/offline/persist";
import { normalizeFeedPage, normalizeProduct } from "@/src/product-normalize";
import { useSession } from "@/src/session";
import type { FeedPage, Product } from "@/src/types";

let syncing = false;
let bootstrapped = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let retries = 0;

type FeedInfinite = {
  pages: FeedPage[];
  pageParams: unknown[];
};

function mergeProductsPreserveOrder(
  current: Product[],
  freshById: Map<string, Product>,
) {
  const kept = current.map((item) => freshById.get(item.id) ?? item);
  const seen = new Set(kept.map((item) => item.id));
  const newcomers: Product[] = [];
  for (const item of freshById.values()) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    newcomers.push(item);
  }
  return [...kept, ...newcomers];
}

/** Refresh feed pages in place so the active reel index stays valid. */
async function softRefreshFeeds(queryClient: QueryClient) {
  const entries = queryClient.getQueriesData<FeedInfinite>({
    queryKey: ["feed"],
  });

  if (!entries.length) {
    await queryClient.invalidateQueries({ queryKey: ["feed"] });
    return;
  }

  await Promise.all(
    entries.map(async ([queryKey, current]) => {
      const tab = String(queryKey[1] ?? "foryou");
      const tokenSlot = queryKey[2];
      const following = tab === "following";

      try {
        const pageCount = Math.max(1, current?.pages?.length ?? 1);
        const freshPages: FeedPage[] = [];
        let cursor = "";

        for (let i = 0; i < pageCount; i += 1) {
          const params = new URLSearchParams({
            status: "ACTIVE",
            limit: "8",
          });
          if (cursor) params.set("cursor", cursor);
          if (following) params.set("following", "1");
          const page = normalizeFeedPage(
            await api<FeedPage>(`/api/products?${params.toString()}`),
          );
          freshPages.push(page);
          cursor = page.nextCursor ?? "";
          if (!cursor) break;
        }

        const freshById = new Map<string, Product>();
        for (const page of freshPages) {
          for (const product of page.products ?? []) {
            try {
              const next = normalizeProduct(product);
              if (next.id) freshById.set(next.id, next);
            } catch {
              /* skip */
            }
          }
        }

        if (!current?.pages?.length) {
          queryClient.setQueryData<FeedInfinite>(queryKey, {
            pages: freshPages,
            pageParams: freshPages.map((_, index) =>
              index === 0 ? "" : (freshPages[index - 1]?.nextCursor ?? ""),
            ),
          });
        } else {
          const flat = current.pages.flatMap((page) => page.products ?? []);
          const merged = mergeProductsPreserveOrder(flat, freshById).map(
            (row) => {
              try {
                return normalizeProduct(row);
              } catch {
                return row;
              }
            },
          );
          // Rebuild pages with same page size as before to keep FlashList stable.
          const size = Math.max(1, current.pages[0]?.products?.length || 8);
          const apiCursor =
            freshPages[freshPages.length - 1]?.nextCursor ?? null;
          const pages: FeedPage[] = [];
          for (let i = 0; i < merged.length; i += size) {
            const slice = merged.slice(i, i + size);
            const isLast = i + size >= merged.length;
            pages.push({
              products: slice,
              // Only the last page may expose a real API cursor — never invent
              // local-* cursors that would be POSTed on scroll.
              nextCursor: isLast ? apiCursor : null,
            });
          }
          if (!pages.length) {
            pages.push(...freshPages);
          }
          queryClient.setQueryData<FeedInfinite>(queryKey, {
            pages,
            pageParams: current.pageParams.slice(0, pages.length),
          });
        }

        if (tab === "foryou" || tab === "following") {
          const token =
            typeof tokenSlot === "string" && tokenSlot !== "guest"
              ? tokenSlot
              : useSession.getState().token;
          const data = queryClient.getQueryData<FeedInfinite>(queryKey);
          persistFeed(token, data?.pages, tab);
        }
      } catch {
        // Keep cached pages — wiping on sync failure closes the offline UX.
      }
    }),
  );

  // Soft-refresh default Discover grid (empty search / no category).
  try {
    const discoverKey = [
      "discover",
      "",
      null,
      useSession.getState().token ?? "guest",
    ] as const;
    const current = queryClient.getQueryData<FeedInfinite>(discoverKey);
    const params = new URLSearchParams({ status: "ACTIVE", limit: "16" });
    const page = normalizeFeedPage(
      await api<FeedPage>(`/api/products?${params.toString()}`),
    );
    if (current?.pages?.length) {
      const freshById = new Map(page.products.map((row) => [row.id, row]));
      const flat = current.pages.flatMap((row) => row.products ?? []);
      const merged = mergeProductsPreserveOrder(flat, freshById);
      const size = Math.max(1, current.pages[0]?.products?.length || 16);
      const pages: FeedPage[] = [];
      for (let i = 0; i < merged.length; i += size) {
        const slice = merged.slice(i, i + size);
        const isLast = i + size >= merged.length;
        pages.push({
          products: slice,
          nextCursor: isLast ? (page.nextCursor ?? null) : null,
        });
      }
      queryClient.setQueryData<FeedInfinite>(discoverKey, {
        pages: pages.length ? pages : [page],
        pageParams: current.pageParams.slice(0, Math.max(1, pages.length)),
      });
    } else {
      queryClient.setQueryData<FeedInfinite>(discoverKey, {
        pages: [page],
        pageParams: [""],
      });
    }
    const data = queryClient.getQueryData<FeedInfinite>(discoverKey);
    persistDiscover(useSession.getState().token, data?.pages);
  } catch {
    /* keep discover cache */
  }
}

async function runSync(
  queryClient: QueryClient,
  reason: "boot" | "focus" | "reconnect",
) {
  if (syncing) return;
  if (!(await isOnline())) return;
  syncing = true;
  try {
    if (reason === "reconnect") await drainOutbox(queryClient);

    if (reason === "reconnect") {
      await softRefreshFeeds(queryClient);
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            key === "cart" ||
            key === "inbox" ||
            key === "conversation" ||
            key === "wanted-changes" ||
            key === "seller-products" ||
            key === "lives" ||
            key === "growth-surface"
          );
        },
      });
    } else {
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            key === "feed" ||
            key === "cart" ||
            key === "inbox" ||
            key === "conversation" ||
            key === "wanted-changes" ||
            key === "seller-products" ||
            key === "lives" ||
            key === "growth-surface"
          );
        },
      });
    }

    kvSet("lastSyncAt", String(Date.now()));
    retries = 0;
  } catch {
    retries += 1;
    if (retries <= 3) {
      const wait = retries === 1 ? 2000 : retries === 2 ? 8000 : 30000;
      setTimeout(() => {
        void runSync(queryClient, reason);
      }, wait);
    }
  } finally {
    syncing = false;
  }
}

function schedule(
  queryClient: QueryClient,
  reason: "boot" | "focus" | "reconnect",
) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(
    () => {
      debounceTimer = null;
      void runSync(queryClient, reason);
    },
    reason === "reconnect" ? 350 : 2000,
  );
}

export function startSilentSync(queryClient: QueryClient) {
  if (bootstrapped) return () => undefined;
  bootstrapped = true;

  onlineManager.setEventListener((setOnline) => {
    let unsub: (() => void) | undefined;
    void watchNetwork((online) => {
      setOnline(online);
      if (online) schedule(queryClient, "reconnect");
    }).then((stop) => {
      unsub = stop;
    });
    return () => unsub?.();
  });

  void isOnline().then((online) => {
    onlineManager.setOnline(online);
    if (online) schedule(queryClient, "boot");
  });

  const onApp = (state: AppStateStatus) => {
    if (state === "active") schedule(queryClient, "focus");
  };
  const appSub = AppState.addEventListener("change", onApp);

  return () => {
    bootstrapped = false;
    appSub.remove();
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}
