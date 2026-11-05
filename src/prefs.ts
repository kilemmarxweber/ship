import * as SecureStore from "expo-secure-store";
import { Appearance, Platform } from "react-native";
import { create } from "zustand";

import { kvGet, kvSet } from "@/src/offline/db";
import type { UserTheme } from "@/src/theme";

export type { UserTheme };

export const LOCALES = ["fr", "en", "pt"] as const;
export type UserLocale = (typeof LOCALES)[number];

const KEY = "shipshop.prefs";

export const LOCALE_OPTIONS: {
  value: UserLocale;
  nativeLabel: string;
  code: string;
}[] = [
  { value: "fr", nativeLabel: "Français", code: "FR" },
  { value: "en", nativeLabel: "English", code: "EN" },
  { value: "pt", nativeLabel: "PT", code: "PT" },
];

export function isUserLocale(value: unknown): value is UserLocale {
  return value === "fr" || value === "en" || value === "pt";
}

export function isUserTheme(value: unknown): value is UserTheme {
  return value === "light" || value === "dark";
}

type PrefsState = {
  ready: boolean;
  locale: UserLocale;
  theme: UserTheme;
  hydrate: () => Promise<void>;
  setLocale: (locale: UserLocale) => Promise<void>;
  setTheme: (theme: UserTheme) => Promise<void>;
  applyRemote: (input: { locale?: unknown; theme?: unknown }) => Promise<void>;
};

async function readPrefs() {
  try {
    const raw =
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem(KEY)
        : await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { locale?: unknown; theme?: unknown };
  } catch {
    return null;
  }
}

async function writePrefs(locale: UserLocale, theme: UserTheme) {
  const payload = JSON.stringify({ locale, theme });
  kvSet("locale", locale);
  kvSet("theme", theme);
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(KEY, payload);
    return;
  }
  await SecureStore.setItemAsync(KEY, payload);
}

function applyNativeTheme(theme: UserTheme) {
  // RN Web / Hermes often expose Appearance without setColorScheme.
  if (Platform.OS === "web") {
    if (typeof document !== "undefined") {
      document.documentElement.style.colorScheme = theme;
    }
    return;
  }
  try {
    const setScheme = (
      Appearance as { setColorScheme?: (scheme: UserTheme | null) => void }
    ).setColorScheme;
    setScheme?.(theme);
  } catch {
    /* ignore unsupported Appearance APIs */
  }
}

export const usePrefs = create<PrefsState>((set, get) => ({
  ready: false,
  locale: "fr",
  theme: "dark",
  hydrate: async () => {
    const stored = await readPrefs();
    const locale = isUserLocale(stored?.locale)
      ? stored.locale
      : isUserLocale(kvGet("locale"))
        ? (kvGet("locale") as UserLocale)
        : "fr";
    const theme = isUserTheme(stored?.theme)
      ? stored.theme
      : isUserTheme(kvGet("theme"))
        ? (kvGet("theme") as UserTheme)
        : "dark";
    kvSet("locale", locale);
    kvSet("theme", theme);
    applyNativeTheme(theme);
    set({ locale, theme, ready: true });
  },
  setLocale: async (locale) => {
    const theme = get().theme;
    await writePrefs(locale, theme);
    set({ locale });
  },
  setTheme: async (theme) => {
    const locale = get().locale;
    await writePrefs(locale, theme);
    applyNativeTheme(theme);
    set({ theme });
  },
  applyRemote: async ({ locale, theme }) => {
    const nextLocale = isUserLocale(locale) ? locale : get().locale;
    const nextTheme = isUserTheme(theme) ? theme : get().theme;
    await writePrefs(nextLocale, nextTheme);
    applyNativeTheme(nextTheme);
    set({ locale: nextLocale, theme: nextTheme });
  },
}));
