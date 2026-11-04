import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import { api } from "@/src/api";
import { isListableProduct } from "@/src/stock";
import type { FeedPage, Product } from "@/src/types";

const SHELF_KEYS = [["feed"], ["discover"], ["discover-deals"]] as const;

type FeedInfinite = InfiniteData<FeedPage>;

function asFeedInfinite(value: unknown): FeedInfinite | undefined {
  if (!value || typeof value !== "object") return undefined;
  const pages = (value as FeedInfinite).pages;
  if (!Array.isArray(pages)) return undefined;
  return value as FeedInfinite;
}

function mapShelfProduct(
  product: Product,
  id: string,
  patch: Product | null | "remove",
): Product | null {
  if (product.id !== id) return product;
  if (patch === "remove" || patch === null) return null;
  return { ...product, ...patch };
}

function patchShelfData(
  value: unknown,
  id: string,
  patch: Product | null | "remove",
) {
  const data = asFeedInfinite(value);
  if (!data) return value;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      products: page.products
        .map((product) => mapShelfProduct(product, id, patch))
        .filter((product): product is Product =>
          Boolean(product && isListableProduct(product)),
        ),
    })),
  };
}

function writeShelf(
  queryClient: QueryClient,
  id: string,
  patch: Product | null | "remove",
) {
  for (const queryKey of SHELF_KEYS) {
    queryClient.setQueriesData({ queryKey: [...queryKey] }, (current) =>
      patchShelfData(current, id, patch),
    );
  }
}

function optimisticProduct(product: Product, soldUnits: number): Product {
  const remaining = Math.max(0, (Number(product.quantity) || 0) - soldUnits);
  return {
    ...product,
    quantity: remaining,
    soldCount: (Number(product.soldCount) || 0) + soldUnits,
    status: remaining <= 0 ? "SOLD" : product.status,
  };
}

function applyOptimistic(value: unknown, sold: Map<string, number>) {
  const data = asFeedInfinite(value);
  if (!data) return value;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      products: page.products
        .map((product) => {
          const units = sold.get(product.id);
          if (!units) return product;
          return optimisticProduct(product, units);
        })
        .filter(isListableProduct),
    })),
  };
}

export async function refreshSoldProducts(
  queryClient: QueryClient,
  lines: { id: string; quantity: number }[],
) {
  const sold = new Map<string, number>();
  for (const line of lines) {
    if (!line.id) continue;
    sold.set(line.id, (sold.get(line.id) ?? 0) + Math.max(1, line.quantity));
  }
  if (sold.size === 0) return;

  for (const queryKey of SHELF_KEYS) {
    queryClient.setQueriesData({ queryKey: [...queryKey] }, (current) =>
      applyOptimistic(current, sold),
    );
  }

  await Promise.all(
    [...sold.keys()].map(async (id) => {
      try {
        const data = await api<{ product?: Product }>(`/api/products/${id}`);
        const product = data.product;
        if (!product || !isListableProduct(product)) {
          writeShelf(queryClient, id, "remove");
          return;
        }
        writeShelf(queryClient, id, product);
      } catch {
        /* keep optimistic shelf */
      }
    }),
  );
}
