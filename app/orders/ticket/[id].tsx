import { router, useLocalSearchParams } from "expo-router";

import { TicketScreen } from "@/components/orders/TicketScreen";

export default function TicketRoute() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!id) {
    router.replace("/orders/index");
    return null;
  }
  return <TicketScreen ticketId={id} />;
}
