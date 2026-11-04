import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

const KEY = "shipshop.token";

async function readToken() {
  if (Platform.OS === "web")
    return globalThis.localStorage?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY);
}

async function writeToken(token: string | null) {
  if (Platform.OS === "web") {
    if (token) globalThis.localStorage?.setItem(KEY, token);
    else globalThis.localStorage?.removeItem(KEY);
    return;
  }
  if (token) await SecureStore.setItemAsync(KEY, token);
  else await SecureStore.deleteItemAsync(KEY);
}

type SessionState = {
  token: string | null;
  ready: boolean;
  authOpen: boolean;
  hydrate: () => Promise<void>;
  setToken: (token: string | null) => Promise<void>;
  logout: () => Promise<void>;
  openAuth: () => void;
  closeAuth: () => void;
};

export const useSession = create<SessionState>((set) => ({
  token: null,
  ready: false,
  authOpen: false,
  hydrate: async () => {
    try {
      const token = await readToken();
      set({ token, ready: true });
    } catch {
      set({ token: null, ready: true });
    }
  },
  setToken: async (token) => {
    await writeToken(token);
    set({ token, authOpen: false });
  },
  logout: async () => {
    await writeToken(null);
    const { wipeUserCache } = await import("@/src/offline/db");
    wipeUserCache();
    set({ token: null, authOpen: true });
  },
  openAuth: () => set({ authOpen: true }),
  closeAuth: () => set({ authOpen: false }),
}));
