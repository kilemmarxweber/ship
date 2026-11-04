import { useLocalSearchParams } from "expo-router";

import { TicketPassScreen } from "@/components/tickets/TicketPassScreen";

export default function TicketPassRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TicketPassScreen ticketId={Array.isArray(id) ? id[0] : id} />;
}
