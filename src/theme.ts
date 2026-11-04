export type UserTheme = "light" | "dark";

export type ThemeColors = {
  background: string;
  emerald: string;
  emeraldDeep: string;
  primary: string;
  primaryForeground: string;
  buyStart: string;
  buyEnd: string;
  live: string;
  white: string;
  muted: string;
  card: string;
  sheet: string;
  ink: string;
  tabBar: string;
  text: string;
  textMuted: string;
};

export const HAIRLINE = "rgba(127,127,140,0.22)";

export const darkColors: ThemeColors = {
  background: "#0A0A0F",
  emerald: "#00D68F",
  emeraldDeep: "#00855A",
  primary: "#FF5722",
  primaryForeground: "#FFFFFF",
  buyStart: "#FF4D8D",
  buyEnd: "#FF8A3D",
  live: "#FF453A",
  white: "#FFFFFF",
  muted: "rgba(255,255,255,0.72)",
  card: "#13131A",
  sheet: "#13131A",
  ink: "#141418",
  tabBar: "#121218",
  text: "#FFFFFF",
  textMuted: "rgba(160,160,176,1)",
};

export const lightColors: ThemeColors = {
  background: "#F3F3F7",
  emerald: "#00855A",
  emeraldDeep: "#006B48",
  primary: "#E64A19",
  primaryForeground: "#FFFFFF",
  buyStart: "#FF4D8D",
  buyEnd: "#FF8A3D",
  live: "#FF3B30",
  white: "#FFFFFF",
  muted: "rgba(20,20,24,0.62)",
  card: "#FFFFFF",
  sheet: "#FFFFFF",
  ink: "#0F0F16",
  tabBar: "#FFFFFF",
  text: "#0F0F16",
  textMuted: "#4A4A5C",
};

export const palettes: Record<UserTheme, ThemeColors> = {
  dark: darkColors,
  light: lightColors,
};

/** Palette sombre par défaut (feed / reels). */
export const colors = darkColors;

export function paletteOf(theme: UserTheme) {
  return palettes[theme];
}

export const categories = [
  "Tech",
  "Mode",
  "Maison",
  "Gaming",
  "Beauté",
  "Auto",
  "Livres",
  "Sport",
] as const;

export const categoryLooks: Record<
  (typeof categories)[number],
  {
    icon:
      | "phone-portrait"
      | "shirt"
      | "home"
      | "game-controller"
      | "sparkles"
      | "car-sport"
      | "book"
      | "barbell";
    colors: [string, string];
  }
> = {
  Tech: { icon: "phone-portrait", colors: ["#0A84FF", "#0A84FF"] },
  Mode: { icon: "shirt", colors: ["#FF375F", "#FF375F"] },
  Maison: { icon: "home", colors: ["#64D2FF", "#64D2FF"] },
  Gaming: { icon: "game-controller", colors: ["#5E5CE6", "#5E5CE6"] },
  Beauté: { icon: "sparkles", colors: ["#BF5AF2", "#BF5AF2"] },
  Auto: { icon: "car-sport", colors: ["#636366", "#636366"] },
  Livres: { icon: "book", colors: ["#FF9F0A", "#FF9F0A"] },
  Sport: { icon: "barbell", colors: ["#30D158", "#30D158"] },
};
