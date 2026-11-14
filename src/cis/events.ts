import { hasAcceptedCisConsent } from "@/src/cis/consent";
import { enqueueCisEvent } from "@/src/cis/outbox";
import { drainCisOutbox } from "@/src/cis/sync";
import type { CisEventInput } from "@/src/cis/types";
import { isOnline } from "@/src/offline/network";
import { useSession } from "@/src/session";

/** Enfile un événement CIS si consentement + session ; tente un flush immédiat. */
export function trackCisEvent(input: CisEventInput) {
  if (!useSession.getState().token) return null;
  if (!hasAcceptedCisConsent()) return null;
  const id = enqueueCisEvent(input);
  void isOnline().then((online) => {
    if (online) void drainCisOutbox();
  });
  return id;
}
