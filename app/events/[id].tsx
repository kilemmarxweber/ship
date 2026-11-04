import { useLocalSearchParams } from "expo-router";

import { EventScreen } from "@/components/events/EventScreen";

export default function EventRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventScreen eventId={Array.isArray(id) ? id[0] : id} />;
}
