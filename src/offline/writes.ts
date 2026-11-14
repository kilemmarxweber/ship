import type { QueryClient } from "@tanstack/react-query";

import { api, ApiError } from "@/src/api";
import { parseCart, type CartItem, type CartPayload } from "@/src/cart";
import { useCart } from "@/src/cart-store";
import { trackCisEvent } from "@/src/cis/events";
import { isOnline } from "@/src/offline/network";
import { enqueueOutbox } from "@/src/offline/outbox";
import { persistCart, writeCartCache } from "@/src/offline/persist";
import type { Product } from "@/src/types";

function networkFail(error: unknown) {
  return !(error instanceof ApiError);
}

export async function requestOrQueue<T>(input: {
  kind: string;
  path: string;
  method: string;
  body?: unknown;
}): Promise<{ queued: false; data: T } | { queued: true; data: null }> {
  const init: RequestInit = { method: input.method };
  if (
    input.body != null &&
    input.method !== "GET" &&
    input.method !== "DELETE"
  ) {
    init.body = JSON.stringify(input.body);
  }
  if (!(await isOnline())) {
    enqueueOutbox({
      kind: input.kind,
      path: input.path,
      method: input.method,
      body: input.body,
    });
    return { queued: true, data: null };
  }
  try {
    const data = await api<T>(input.path, init);
    return { queued: false, data };
  } catch (error) {
    if (!networkFail(error)) throw error;
    enqueueOutbox({
      kind: input.kind,
      path: input.path,
      method: input.method,
      body: input.body,
    });
    return { queued: true, data: null };
  }
}

function cartFromQuery(
  queryClient: QueryClient,
  token: string | null | undefined,
) {
  return parseCart(queryClient.getQueryData(["cart", token ?? "guest"]) ?? {});
}

function commitCart(
  queryClient: QueryClient,
  token: string | null | undefined,
  payload: CartPayload,
) {
  writeCartCache(queryClient, token, payload);
  useCart.getState().setCount(payload.count);
}

export function patchCartQuantity(
  queryClient: QueryClient,
  token: string | null | undefined,
  productId: string,
  quantity: number,
  product?: Product | CartItem["product"],
) {
  const current = cartFromQuery(queryClient, token);
  let items = current.items.filter((item) => item.productId !== productId);
  if (quantity >= 1) {
    const existing = current.items.find((item) => item.productId === productId);
    const rowProduct =
      existing?.product ??
      (product
        ? {
            id: product.id,
            title: product.title,
            priceCents: product.priceCents,
            currency: "currency" in product ? product.currency : "USD",
            images: product.images ?? [],
            shop:
              "shop" in product && product.shop
                ? {
                    id: product.shop.id,
                    name: product.shop.name,
                    slug: product.shop.slug ?? "",
                  }
                : { id: "shop", name: "Boutique", slug: "" },
          }
        : null);
    if (rowProduct) {
      items = [
        ...items,
        {
          id: existing?.id ?? productId,
          productId,
          quantity,
          product: rowProduct,
        },
      ];
    }
  }
  const totalCents = items.reduce(
    (sum, item) => sum + item.product.priceCents * item.quantity,
    0,
  );
  commitCart(queryClient, token, { items, totalCents, count: items.length });
}

export async function saveCartLine(
  queryClient: QueryClient,
  token: string | null | undefined,
  input: {
    productId: string;
    quantity: number;
    increment?: boolean;
    product?: Product | CartItem["product"];
  },
) {
  const current = cartFromQuery(queryClient, token);
  const already =
    current.items.find((item) => item.productId === input.productId)
      ?.quantity ?? 0;
  const nextQty = input.increment ? already + input.quantity : input.quantity;
  patchCartQuantity(
    queryClient,
    token,
    input.productId,
    nextQty,
    input.product,
  );
  const result = await requestOrQueue<unknown>({
    kind: "cart",
    path: "/api/cart",
    method: "POST",
    body: {
      productId: input.productId,
      quantity: input.increment ? input.quantity : nextQty,
      increment: Boolean(input.increment),
    },
  });
  if (!result.queued && result.data) {
    const parsed = parseCart(result.data);
    commitCart(queryClient, token, parsed);
    persistCart(token, parsed);
  }
  trackCisEvent({
    type: "add_to_cart",
    productId: input.productId,
    shopId:
      input.product && "shop" in input.product ? input.product.shop?.id : null,
    category:
      input.product && "category" in input.product
        ? (input.product.category as string | undefined)
        : null,
    payload: {
      quantity: input.increment ? input.quantity : nextQty,
      increment: Boolean(input.increment),
    },
  });
}

export async function removeCartLine(
  queryClient: QueryClient,
  token: string | null | undefined,
  productId: string,
) {
  patchCartQuantity(queryClient, token, productId, 0);
  const result = await requestOrQueue<unknown>({
    kind: "cart",
    path: `/api/cart?productId=${encodeURIComponent(productId)}`,
    method: "DELETE",
  });
  if (!result.queued && result.data) {
    commitCart(queryClient, token, parseCart(result.data));
  }
}

export async function clearCartLines(
  queryClient: QueryClient,
  token: string | null | undefined,
) {
  commitCart(queryClient, token, { items: [], totalCents: 0, count: 0 });
  const result = await requestOrQueue<unknown>({
    kind: "cart",
    path: "/api/cart?all=1",
    method: "DELETE",
  });
  if (!result.queued && result.data) {
    commitCart(queryClient, token, parseCart(result.data));
  }
}
