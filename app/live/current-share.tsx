import { Redirect } from "expo-router";

import { getActiveScreenShareLiveId } from "@/src/live-share-session";

/** Deep link shipshop://live/current-share — notif FGS → live en cours. */
export default function CurrentShareRoute() {
  const liveId = getActiveScreenShareLiveId();
  if (!liveId) {
    return <Redirect href="/" />;
  }
  return <Redirect href={`/live/${liveId}`} />;
}
