import { router, useLocalSearchParams } from "expo-router";

import { OrderScreen } from "@/components/orders/OrderScreen";

export default function OrderRoute() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!id) {
    router.replace("/orders/index");
    return null;
  }
  return <OrderScreen orderId={id} />;
}
