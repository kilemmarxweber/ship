import { api, ApiError } from "@/src/api";
import { hasAcceptedCisConsent } from "@/src/cis/consent";
import {
  cisOutboxBump,
  cisOutboxList,
  cisOutboxRemove,
} from "@/src/cis/outbox";
import { isOnline } from "@/src/offline/network";
import { useSession } from "@/src/session";

let draining = false;

export async function drainCisOutbox() {
  if (draining) return;
  if (!useSession.getState().token) return;
  if (!hasAcceptedCisConsent()) return;
  if (!(await isOnline())) return;

  draining = true;
  try {
    const rows = cisOutboxList();
    if (!rows.length) return;

    const batchSize = 40;
    for (let i = 0; i < rows.length; i += batchSize) {
      const slice = rows.slice(i, i + batchSize);
      const events = [];
      for (const row of slice) {
        try {
          events.push(JSON.parse(row.body));
        } catch {
          cisOutboxRemove(row.id);
        }
      }
      if (!events.length) continue;

      try {
        await api("/api/cis/events", {
          method: "POST",
          body: JSON.stringify({ events }),
        });
        for (const row of slice) cisOutboxRemove(row.id);
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          for (const row of slice) cisOutboxRemove(row.id);
          return;
        }
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          for (const row of slice) cisOutboxRemove(row.id);
          continue;
        }
        for (const row of slice) {
          const tries = row.tries + 1;
          if (tries >= 8) cisOutboxRemove(row.id);
          else cisOutboxBump(row.id, tries);
        }
        return;
      }
    }
  } finally {
    draining = false;
  }
}
