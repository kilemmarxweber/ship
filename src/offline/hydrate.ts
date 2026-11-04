import type { QueryClient } from "@tanstack/react-query";

import { useCart } from "@/src/cart-store";
import { openOfflineDb } from "@/src/offline/db";
import { cartFromCache, injectSnapshots } from "@/src/offline/persist";
import { useSession } from "@/src/session";

export async function hydrateOffline(queryClient: QueryClient) {
  await openOfflineDb();
  const token = useSession.getState().token;
  injectSnapshots(queryClient, token);
  const cart = cartFromCache(token);
  if (cart.count) useCart.getState().setCount(cart.count);
}
