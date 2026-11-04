import { router, useLocalSearchParams } from "expo-router";

import { WantedDetailScreen } from "@/components/wanted/WantedDetailScreen";

export default function WantedRoute() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!id) {
    router.back();
    return null;
  }
  return <WantedDetailScreen requestId={id} />;
}
