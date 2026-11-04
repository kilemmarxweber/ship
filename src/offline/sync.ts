import { onlineManager, type QueryClient } from "@tanstack/react-query";
import { AppState, type AppStateStatus } from "react-native";

import { kvSet } from "@/src/offline/db";
import { isOnline, watchNetwork } from "@/src/offline/network";
import { drainOutbox } from "@/src/offline/outbox";

let syncing = false;
let bootstrapped = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let retries = 0;

async function runSync(
  queryClient: QueryClient,
  reason: "boot" | "focus" | "reconnect",
) {
  if (syncing) return;
  if (!(await isOnline())) return;
  syncing = true;
  try {
    if (reason === "reconnect") await drainOutbox(queryClient);
    await queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return (
          key === "feed" ||
          key === "cart" ||
          key === "inbox" ||
          key === "conversation" ||
          key === "wanted-changes"
        );
      },
    });
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
    reason === "reconnect" ? 400 : 2000,
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
