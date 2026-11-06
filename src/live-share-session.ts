/** Live id courant pendant un partage d’écran (notif → retour Meet-style). */
let activeLiveId: string | null = null;

export function setActiveScreenShareLiveId(liveId: string | null) {
  activeLiveId = liveId;
}

export function getActiveScreenShareLiveId() {
  return activeLiveId;
}
