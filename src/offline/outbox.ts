import { api } from "@/src/api";
import { parseCart } from "@/src/cart";
import { cartQueryKey, useCart } from "@/src/cart-store";
import { persistCart } from "@/src/offline/persist";
import {
  outboxBump,
  outboxEnqueue,
  outboxList,
  outboxRemove,
  type OutboxRow,
} from "@/src/offline/db";
import { isOnline } from "@/src/offline/network";
import { showToast } from "@/src/toast";
import type { QueryClient } from "@tanstack/react-query";

let draining = false;

export function enqueueOutbox(input: {
  kind: string;
  path: string;
  method: string;
  body?: unknown;
}) {
  outboxEnqueue({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    path: input.path,
    method: input.method,
    body: input.body == null ? null : JSON.stringify(input.body),
    createdAt: Date.now(),
  });
}

export async function drainOutbox(queryClient?: QueryClient) {
  if (draining) return;
  if (!(await isOnline())) return;
  draining = true;
  try {
    const rows = outboxList();
    for (const row of rows) {
      try {
        await replay(row);
        outboxRemove(row.id);
      } catch {
        const tries = row.tries + 1;
        if (tries > 5) {
          outboxRemove(row.id);
          showToast("Une action hors-ligne n’a pas pu partir", "error");
        } else {
          outboxBump(row.id, tries);
        }
      }
    }
    const token = (
      await import("@/src/session")
    ).useSession.getState().token;
    if (queryClient && token) {
      const raw = await api<unknown>("/api/cart").catch(() => null);
      if (raw) {
        const parsed = parseCart(raw);
        queryClient.setQueryData(cartQueryKey(token), raw);
        useCart.getState().setCount(parsed.count);
        persistCart(token, parsed);
      }
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
      void queryClient.invalidateQueries({ queryKey: ["conversation"] });
    }
  } finally {
    draining = false;
  }
}

async function replay(row: OutboxRow) {
  const init: RequestInit = { method: row.method };
  if (row.body && row.method !== "GET" && row.method !== "DELETE") {
    init.body = row.body;
  }
  await api(row.path, init);
}
