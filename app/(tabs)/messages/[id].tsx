import { useLocalSearchParams } from "expo-router";

import { ThreadScreen } from "@/components/messages/ThreadScreen";

export default function ConversationRoute() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  return <ThreadScreen id={id} />;
}
