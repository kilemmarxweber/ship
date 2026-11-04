export function compactCount(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function formatMoney(cents: number, currency = "USD") {
  const amount = (Number.isFinite(cents) ? cents : 0) / 100;
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  if (currency === "CDF") return `${formatted} CDF`;
  if (currency === "KW") return `${formatted} KW`;
  return `${formatted} $US`;
}
