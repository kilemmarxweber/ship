import { useWindowDimensions } from "react-native";

const BASE_WIDTH = 390;

/** Phone stays 1:1. Larger windows grow the bar, then level off. */
export function tabBarScale(width: number) {
  const raw = width / BASE_WIDTH;
  if (raw <= 1) return Math.max(0.88, raw);
  return Math.min(1.55, 1 + (raw - 1) * 0.42);
}

export function tabBarMetrics(width: number) {
  const scale = tabBarScale(width);
  const fab = Math.round(56 * scale);
  const gap = Math.round(9 * scale);
  return {
    scale,
    fab,
    gap,
    holeR: fab / 2 + gap,
    cy: Math.round(16 * scale),
    barBody: Math.round(64 * scale),
    icon: Math.round(24 * scale),
    plus: Math.round(30 * scale),
    label: Math.max(11, Math.round(11 * scale)),
    badge: Math.max(10, Math.round(10 * scale)),
    radius: Math.round(28 * scale),
    padTop: Math.round(10 * scale),
  };
}

export function useTabBarMetrics() {
  const { width } = useWindowDimensions();
  return tabBarMetrics(width);
}
