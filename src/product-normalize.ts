import type { FeedPage, Product } from "@/src/types";
import { isListableProduct } from "@/src/stock";

/** Normalize API / offline product rows so list UIs never crash on bad data. */
export function normalizeProduct(product: Product): Product {
  return {
    ...product,
    id: typeof product.id === "string" ? product.id : String(product.id ?? ""),
    title: typeof product.title === "string" ? product.title : "Produit",
    images: Array.isArray(product.images)
      ? product.images.filter(
          (url): url is string =>
            typeof url === "string" && url.trim().length > 0,
        )
      : [],
    colors: Array.isArray(product.colors) ? product.colors : [],
    sizes: Array.isArray(product.sizes) ? product.sizes : [],
    description: product.description ?? null,
    quantity: product.quantity ?? 0,
    soldCount: product.soldCount ?? 0,
    status: product.status ?? "ACTIVE",
    likesCount: product.likesCount ?? 0,
    commentsCount: product.commentsCount ?? 0,
    likedByMe: Boolean(product.likedByMe),
    shop: product.shop ?? {
      id: "unknown",
      name: "Boutique",
      slug: "unknown",
    },
  };
}

/** Fake cursors from soft offline merge — never send them to the API. */
export function isLocalFeedCursor(cursor: unknown) {
  return typeof cursor === "string" && cursor.startsWith("local-");
}

export function safeNextCursor(page: {
  nextCursor?: string | null;
  products?: unknown[];
}) {
  const cursor = page.nextCursor ?? null;
  if (!cursor || isLocalFeedCursor(cursor)) return undefined;
  if (!page.products || page.products.length === 0) return undefined;
  return cursor;
}

export function normalizeFeedPage(page: FeedPage): FeedPage {
  const seen = new Set<string>();
  const products: Product[] = [];
  for (const raw of page.products ?? []) {
    try {
      const product = normalizeProduct(raw);
      if (!product.id || seen.has(product.id) || !isListableProduct(product)) {
        continue;
      }
      seen.add(product.id);
      products.push(product);
    } catch {
      /* skip corrupt row */
    }
  }
  return {
    ...page,
    products,
    nextCursor: page.nextCursor ?? null,
  };
}

export function flattenUniqueProducts(pages: FeedPage[] | undefined) {
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const page of pages ?? []) {
    for (const raw of page.products ?? []) {
      try {
        const product = normalizeProduct(raw);
        if (!product.id || seen.has(product.id) || !isListableProduct(product)) {
          continue;
        }
        seen.add(product.id);
        out.push(product);
      } catch {
        /* skip */
      }
    }
  }
  return out;
}
