import { router, useLocalSearchParams } from "expo-router";

import { LiveScreen } from "@/components/live/LiveScreen";

export default function LiveRoute() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!id) {
    router.replace("/");
    return null;
  }
  return <LiveScreen key={id} liveId={id} />;
}
