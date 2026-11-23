import type { AppCurrency } from "@/src/product-options";

export const RAIL_PROVIDERS = ["MPESA", "ORANGE", "AIRTEL"] as const;
export type RailProvider = (typeof RAIL_PROVIDERS)[number];

export const WALLET_BUCKETS = ["BUYER", "VENDOR", "COURIER"] as const;
export type WalletBucket = (typeof WALLET_BUCKETS)[number];

export type WalletBalances = {
  balanceCents?: number;
  currency?: string | null;
  usdCents?: number;
  cdfCents?: number;
  kwCents?: number;
};

export type WalletPots = {
  BUYER: number;
  VENDOR: number;
  COURIER: number;
};

export type WalletTxn = {
  id: string;
  type: string;
  amountCents: number;
  currency?: string;
  status: string;
  provider: string;
  phone: string | null;
  reference: string | null;
  createdAt: string;
};

export type PayResult = {
  error?: string;
  transactionId?: string | null;
  movementId?: string;
  status?: string;
  ussdHint?: string | null;
  paymentUrl?: string | null;
  alreadyApplied?: boolean;
  alreadyConfirmed?: boolean;
  beneficiaryUserId?: string | null;
  balanceCents?: number;
  payerBalanceAfter?: number;
  currency?: string;
};

export function parseWalletCurrency(value?: string | null): AppCurrency {
  if (value === "CDF" || value === "KW" || value === "USD") return value;
  return "USD";
}

export function walletCents(
  wallet: WalletBalances | null | undefined,
  currency?: string | null,
) {
  const code = parseWalletCurrency(currency ?? wallet?.currency);
  if (!wallet) return 0;
  if (code === "CDF") return Math.max(0, wallet.cdfCents ?? 0);
  if (code === "KW") return Math.max(0, wallet.kwCents ?? 0);
  const usd = Math.max(0, wallet.usdCents ?? 0);
  const display = Math.max(0, wallet.balanceCents ?? 0);
  return usd > 0 ? usd : display;
}

export function emptyPots(): WalletPots {
  return { BUYER: 0, VENDOR: 0, COURIER: 0 };
}

export function providerLabel(id: string) {
  if (id === "MPESA") return "M-Pesa";
  if (id === "ORANGE") return "Orange";
  if (id === "AIRTEL") return "Airtel";
  if (id === "INTERNAL") return "Solde ShipShop";
  return id;
}

export function txnLabel(type: string) {
  if (type === "REFUND") return "Remboursement";
  if (type === "PURCHASE") return "Achat";
  if (type === "ADJUSTMENT") return "Ajustement";
  if (type === "TRANSFER_IN") return "Reçu";
  if (type === "TRANSFER_OUT") return "Envoyé";
  if (type === "DEPOSIT") return "Recharge";
  if (type === "WITHDRAWAL") return "Retrait";
  return type;
}

export function bucketLabel(bucket: WalletBucket) {
  if (bucket === "VENDOR") return "Ventes";
  if (bucket === "COURIER") return "Courses";
  return "À dépenser";
}

export function withdrawFeePct(
  bucket: WalletBucket,
  withdrawFeePctValue = 5,
) {
  return bucket === "VENDOR" ? 0 : withdrawFeePctValue;
}

export function depositFeeCents(grossCents: number, depositFeePct = 5) {
  return Math.floor(Math.max(0, grossCents) * depositFeePct / 100);
}
