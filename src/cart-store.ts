import { create } from "zustand";

import { api } from "@/src/api";
import { parseCart } from "@/src/cart";
import { useSession } from "@/src/session";

export function cartQueryKey(token?: string | null) {
  return ["cart", token ?? useSession.getState().token ?? "guest"] as const;
}

type CartState = {
  count: number;
  setCount: (count: number) => void;
  refresh: () => Promise<void>;
};

export const useCart = create<CartState>((set) => ({
  count: 0,
  setCount: (count) => set({ count: Math.max(0, Math.floor(count)) }),
  refresh: async () => {
    const token = useSession.getState().token;
    if (!token) {
      set({ count: 0 });
      return;
    }
    try {
      const data = parseCart(await api<unknown>("/api/cart"));
      set({ count: data.items.length });
      const { persistCart } = await import("@/src/offline/persist");
      persistCart(token, data);
    } catch {
      const { cartFromCache } = await import("@/src/offline/persist");
      const cached = cartFromCache(token);
      set({ count: cached.count });
    }
  },
}));
