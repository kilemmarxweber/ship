const PRESET_COLORS: Record<string, string> = {
  noir: "#111111",
  blanc: "#f5f5f5",
  rouge: "#ef4444",
  bleu: "#3b82f6",
  vert: "#22c55e",
  or: "#f59e0b",
  argent: "#94a3b8",
  rose: "#ec4899",
  black: "#111111",
  white: "#f5f5f5",
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  gold: "#f59e0b",
  silver: "#94a3b8",
  pink: "#ec4899",
};

export function colorHex(name: string) {
  const raw = name.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw)) return raw;
  if (/^(rgb|hsl)a?\(/i.test(raw)) return raw;
  return PRESET_COLORS[raw.toLowerCase()] ?? raw;
}

export function isLightColor(name: string) {
  const hex = colorHex(name).replace("#", "");
  if (hex.length !== 6 && hex.length !== 8) return false;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 186;
}
