export const PRESET_COLORS = [
  { name: "Noir", hex: "#111111" },
  { name: "Blanc", hex: "#f5f5f5" },
  { name: "Rouge", hex: "#ef4444" },
  { name: "Bleu", hex: "#3b82f6" },
  { name: "Vert", hex: "#22c55e" },
  { name: "Or", hex: "#f59e0b" },
  { name: "Argent", hex: "#94a3b8" },
  { name: "Rose", hex: "#ec4899" },
] as const;

export const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Unique"];
export const SHOE_SIZES = [
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
];

export const APP_CURRENCIES = ["USD", "CDF", "KW"] as const;
export type AppCurrency = (typeof APP_CURRENCIES)[number];

export const DEFAULT_FX_CDF = 2400;

export function sanitizePriceInput(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  const whole = cleaned.slice(0, dot);
  const fraction = cleaned
    .slice(dot + 1)
    .replace(/\./g, "")
    .slice(0, 2);
  return `${whole}.${fraction}`;
}

export function priceToCents(raw: string) {
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}
