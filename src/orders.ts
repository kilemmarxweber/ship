export type FulfillmentType = "PICKUP" | "DELIVERY";

export type CheckoutTicket = {
  id: string;
  shopId: string;
  shopName: string;
  code: string;
  qrPayload: string;
  orderIds: string[];
  itemCount: number;
};

export type CheckoutResult = {
  orders?: {
    id: string;
    fulfillmentType?: string;
    courierId?: string | null;
  }[];
  tickets?: CheckoutTicket[];
  balanceCents?: number;
  count?: number;
};

export type OrderCourier = {
  id: string;
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  lastLat?: number | null;
  lastLng?: number | null;
};

export type PickupReceipt = {
  code: string;
  qrPayload: string;
  scannedAt?: string | null;
  redeemedAt?: string | null;
};

export type DeliveryEvent = {
  id: string;
  status: string;
  note?: string | null;
  createdAt: string;
};

export type OrderDetail = {
  id: string;
  status: string;
  escrowReleasedAt?: string | null;
  productCents?: number;
  shippingCents?: number;
  totalCents?: number;
  amountCents?: number;
  fulfillmentType: FulfillmentType;
  deliveryAddress?: string | null;
  deliveryCommune?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  courierDistanceKm?: number | null;
  etaMinutes?: number | null;
  etaAt?: string | null;
  proximityNotifiedAt?: string | null;
  product: { title: string; images: string[] };
  shop: { id: string; name: string };
  courier?: OrderCourier | null;
  pickupReceipt?: PickupReceipt | null;
  handover?: {
    id: string;
    code: string;
    qrPayload: string;
    completedAt?: string | null;
    orders?: {
      id: string;
      status: string;
      product: { title: string; images: string[] };
      pickupReceipt?: {
        scannedAt?: string | null;
        redeemedAt?: string | null;
      } | null;
    }[];
  } | null;
  deliveryEvents?: DeliveryEvent[];
};

export type OrderListItem = {
  id: string;
  status: string;
  fulfillmentType?: FulfillmentType;
  totalCents?: number;
  amountCents?: number;
  product?: { title?: string; images?: string[] };
  shop?: { name?: string };
  handover?: { id: string; code?: string } | null;
  pickupReceipt?: PickupReceipt | null;
  courier?: OrderCourier | null;
};

export const STATUS_LABEL: Record<string, string> = {
  PAID: "Payé",
  ASSIGNED: "Livreur attribué",
  FULFILLING: "Préparation",
  OUT_FOR_DELIVERY: "En route",
  READY_FOR_PICKUP: "Prêt au retrait",
  AWAITING_CONFIRM: "À confirmer",
  PICKED_UP: "Retiré",
  DELIVERED: "Livré",
  FAILED: "Échec",
  REFUNDED: "Remboursé",
  CANCELLED: "Annulé",
};

export function statusLabel(status: string) {
  return STATUS_LABEL[status] ?? status;
}

export function isTransitStepActive(order: {
  status: string;
  fulfillmentType?: string;
  escrowReleasedAt?: string | null;
}) {
  if (
    order.escrowReleasedAt ||
    order.status === "DELIVERED" ||
    order.status === "PICKED_UP"
  ) {
    return true;
  }
  if (order.fulfillmentType === "PICKUP") {
    return (
      order.status === "READY_FOR_PICKUP" || order.status === "AWAITING_CONFIRM"
    );
  }
  return [
    "ASSIGNED",
    "FULFILLING",
    "OUT_FOR_DELIVERY",
    "AWAITING_CONFIRM",
  ].includes(order.status);
}

export function isLiveTracking(order: OrderDetail) {
  return (
    order.fulfillmentType === "DELIVERY" &&
    Boolean(order.courier) &&
    order.status === "OUT_FOR_DELIVERY"
  );
}

export function isAwaitingConfirm(order: OrderDetail) {
  return (
    order.status === "AWAITING_CONFIRM" ||
    Boolean(order.pickupReceipt?.scannedAt && !order.pickupReceipt.redeemedAt)
  );
}

export function liveEtaText(order: OrderDetail, now = Date.now()) {
  if (!order.etaAt) {
    if (order.etaMinutes == null) return null;
    return formatEtaMinutes(order.etaMinutes);
  }
  const ms = new Date(order.etaAt).getTime() - now;
  if (ms <= 0) return "imminent";
  return formatEtaMinutes(Math.ceil(ms / 60000));
}

function formatEtaMinutes(mins: number) {
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

export function courierPoint(courier: OrderCourier | null | undefined) {
  if (!courier) return null;
  if (
    typeof courier.lastLat === "number" &&
    typeof courier.lastLng === "number"
  ) {
    return { lat: courier.lastLat, lng: courier.lastLng };
  }
  if (typeof courier.lat === "number" && typeof courier.lng === "number") {
    return { lat: courier.lat, lng: courier.lng };
  }
  return null;
}

export type CheckoutHref =
  | "/orders/index"
  | { pathname: "/orders/[id]"; params: { id: string } }
  | { pathname: "/orders/ticket/[id]"; params: { id: string } };

export function checkoutPath(
  result: CheckoutResult,
  fulfillmentType: FulfillmentType,
): CheckoutHref {
  if (fulfillmentType === "DELIVERY" && result.orders?.[0]?.id) {
    return { pathname: "/orders/[id]", params: { id: result.orders[0].id } };
  }
  if (result.tickets?.[0]?.id) {
    return {
      pathname: "/orders/ticket/[id]",
      params: { id: result.tickets[0].id },
    };
  }
  if (result.orders?.[0]?.id) {
    return { pathname: "/orders/[id]", params: { id: result.orders[0].id } };
  }
  return "/orders/index";
}

export function destinationPoint(order: OrderDetail) {
  if (
    typeof order.deliveryLat === "number" &&
    typeof order.deliveryLng === "number"
  ) {
    return { lat: order.deliveryLat, lng: order.deliveryLng };
  }
  return null;
}
