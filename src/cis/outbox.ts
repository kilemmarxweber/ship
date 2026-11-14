import {
  cisOutboxBump,
  cisOutboxEnqueue,
  cisOutboxList,
  cisOutboxRemove,
} from "@/src/offline/db";
import type { CisEventInput } from "@/src/cis/types";

function makeId() {
  return `cis_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function enqueueCisEvent(input: CisEventInput) {
  const id = makeId();
  const body = {
    clientEventId: id,
    type: input.type,
    productId: input.productId ?? null,
    shopId: input.shopId ?? null,
    category: input.category ?? null,
    query: input.query ?? null,
    payload: input.payload ?? {},
    occurredAt: input.occurredAt ?? Date.now(),
  };
  cisOutboxEnqueue({
    id,
    type: input.type,
    body: JSON.stringify(body),
    createdAt: Date.now(),
  });
  return id;
}

export {
  cisOutboxBump,
  cisOutboxList,
  cisOutboxRemove,
};
