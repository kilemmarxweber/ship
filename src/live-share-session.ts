import { kvGet, kvSet } from "@/src/offline/db";

/** Live id courant pendant un partage d’écran (notif → retour Meet-style). */
const KEY = "screenShare.liveId";
let activeLiveId: string | null = null;

export function setActiveScreenShareLiveId(liveId: string | null) {
  activeLiveId = liveId;
  try {
    kvSet(KEY, liveId ?? "");
  } catch {
    /* offline db may not be ready */
  }
}

export function getActiveScreenShareLiveId() {
  if (activeLiveId) return activeLiveId;
  try {
    const stored = kvGet(KEY);
    activeLiveId = stored && stored.length > 0 ? stored : null;
  } catch {
    /* ignore */
  }
  return activeLiveId;
}
