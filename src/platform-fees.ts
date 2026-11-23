export type PublicFeeSettings = {
  depositFeeBps: number;
  depositCinetPayBps: number;
  depositFeePct: number;
  depositCinetPayPct: number;
  withdrawFeeBps: number;
  withdrawCinetPayBps: number;
  withdrawFeePct: number;
  withdrawCinetPayPct: number;
  transferExternalFeeBps: number;
  transferExternalCinetPayBps: number;
  transferExternalFeePct: number;
  transferExternalCinetPayPct: number;
  transferInternalFeeBps: number;
  transferInternalFeePct: number;
  saleFeeBpsDefault: number;
  saleFeePctDefault: number;
  shippingFeeBps: number;
  shippingFeePct: number;
};

export const DEFAULT_PUBLIC_FEES: PublicFeeSettings = {
  depositFeeBps: 500,
  depositCinetPayBps: 300,
  depositFeePct: 5,
  depositCinetPayPct: 3,
  withdrawFeeBps: 500,
  withdrawCinetPayBps: 300,
  withdrawFeePct: 5,
  withdrawCinetPayPct: 3,
  transferExternalFeeBps: 500,
  transferExternalCinetPayBps: 300,
  transferExternalFeePct: 5,
  transferExternalCinetPayPct: 3,
  transferInternalFeeBps: 0,
  transferInternalFeePct: 0,
  saleFeeBpsDefault: 500,
  saleFeePctDefault: 5,
  shippingFeeBps: 1000,
  shippingFeePct: 10,
};

export function feeCentsFromBps(grossCents: number, bps: number) {
  if (bps <= 0) return 0;
  return Math.floor(Math.max(0, grossCents) * bps / 10_000);
}

export function netShipshopPct(feePct: number, cinetPct: number) {
  return Math.max(0, feePct - cinetPct);
}

export const REVENUE_SOURCE_LABELS: Record<string, string> = {
  deposit: "Versement",
  withdrawal: "Retrait",
  transferExternal: "Transfert hors ShipShop",
  transferInternal: "Transfert interne",
  sale: "Achat",
  shipping: "Livraison",
  ticket: "Billets",
  ads: "Pubs",
  challenges: "Challenges",
  other: "Autres",
};
