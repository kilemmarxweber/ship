import { APP_CURRENCIES, type AppCurrency } from "@/src/product-options";

export type FxRates = {
  cdfPerUsd: number;
  kwPerUsd: number;
};

export const DEFAULT_FX: FxRates = {
  cdfPerUsd: 2400,
  kwPerUsd: 1,
};

export function parseAppCurrency(value?: string | null): AppCurrency {
  const code = (value ?? "USD").toUpperCase();
  return (APP_CURRENCIES as readonly string[]).includes(code)
    ? (code as AppCurrency)
    : "USD";
}

export function eventFxRates(event?: {
  fxCdfPerUsd?: number | null;
  fxKwPerUsd?: number | null;
} | null): FxRates {
  return {
    cdfPerUsd: Math.max(1, Math.round(event?.fxCdfPerUsd ?? DEFAULT_FX.cdfPerUsd)),
    kwPerUsd: Math.max(1, Math.round(event?.fxKwPerUsd ?? DEFAULT_FX.kwPerUsd)),
  };
}

function unitsPerUsd(currency: AppCurrency, fx: FxRates) {
  if (currency === "CDF") return fx.cdfPerUsd;
  if (currency === "KW") return fx.kwPerUsd;
  return 1;
}

export function convertCents(
  amountCents: number,
  from: string | null | undefined,
  to: string | null | undefined,
  fx: FxRates = DEFAULT_FX,
) {
  const src = parseAppCurrency(from);
  const dest = parseAppCurrency(to);
  const cents = Math.max(0, Math.floor(amountCents));
  if (src === dest) return cents;
  const usd =
    unitsPerUsd(src, fx) === 1
      ? cents
      : Math.floor(cents / unitsPerUsd(src, fx));
  return usd * unitsPerUsd(dest, fx);
}
