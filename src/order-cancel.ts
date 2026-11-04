export const CANCEL_REASONS = {
  OUT_OF_STOCK: { label: "Stock épuisé" },
  DEFECTIVE: { label: "Produit défectueux" },
  DAMAGED: { label: "Produit endommagé" },
  UNAVAILABLE: { label: "Produit indisponible" },
  LOGISTICS: { label: "Problème de livraison" },
  OTHER: { label: "Autre motif" },
} as const;

export type CancelReasonCode = keyof typeof CANCEL_REASONS;

export const CANCEL_REASON_CODES = Object.keys(
  CANCEL_REASONS,
) as CancelReasonCode[];

export function isOrderCancellable(
  status: string,
  redeemedAt?: Date | string | null,
  scannedAt?: Date | string | null,
) {
  if (redeemedAt || scannedAt) return false;
  if (
    status === "DELIVERED" ||
    status === "PICKED_UP" ||
    status === "AWAITING_CONFIRM"
  ) {
    return false;
  }
  return [
    "PAID",
    "ASSIGNED",
    "FULFILLING",
    "OUT_FOR_DELIVERY",
    "READY_FOR_PICKUP",
    "FAILED",
  ].includes(status);
}

export const SALE_FEE_BPS_DEFAULT = 500;

export function resolveSaleFeeCents(
  productCents: number,
  saleFeeCents?: number,
  saleFeeBps?: number,
) {
  if (saleFeeCents != null) return saleFeeCents;
  return Math.floor(
    (Math.max(0, productCents) * (saleFeeBps ?? SALE_FEE_BPS_DEFAULT)) / 10_000,
  );
}
