import { mediaUrl } from "@/src/api";
import { formatMoney } from "@/src/format";

export type CartProduct = {
  id: string;
  title: string;
  priceCents: number;
  compareAtCents?: number | null;
  promoPercent?: number | null;
  currency?: string;
  images: string[];
  status?: string;
  quantity?: number;
  stockRemaining?: number;
  soldCount?: number;
  shop: { id: string; name: string; slug: string };
};

export type CartItem = {
  id: string;
  productId: string;
  quantity: number;
  product: CartProduct;
};

export type CartPayload = {
  items: CartItem[];
  totalCents: number;
  count: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asProduct(value: unknown): CartProduct | null {
  const row = asRecord(value);
  if (!row || typeof row.id !== "string" || typeof row.title !== "string")
    return null;
  const shop = asRecord(row.shop);
  const images = Array.isArray(row.images)
    ? row.images.filter((item) => typeof item === "string")
    : [];
  return {
    id: row.id,
    title: row.title,
    priceCents: Number(row.priceCents) || 0,
    compareAtCents:
      typeof row.compareAtCents === "number" ? row.compareAtCents : null,
    promoPercent:
      typeof row.promoPercent === "number" ? row.promoPercent : null,
    currency: typeof row.currency === "string" ? row.currency : "USD",
    images,
    status: typeof row.status === "string" ? row.status : "ACTIVE",
    quantity: Number.isFinite(Number(row.stockRemaining ?? row.quantity))
      ? Math.max(0, Math.floor(Number(row.stockRemaining ?? row.quantity)))
      : undefined,
    stockRemaining: Number.isFinite(Number(row.stockRemaining ?? row.quantity))
      ? Math.max(0, Math.floor(Number(row.stockRemaining ?? row.quantity)))
      : undefined,
    soldCount: Number.isFinite(Number(row.soldCount))
      ? Math.max(0, Math.floor(Number(row.soldCount)))
      : Number.isFinite(Number(asRecord(row._count)?.orders))
        ? Math.max(0, Math.floor(Number(asRecord(row._count)?.orders)))
        : undefined,
    shop: {
      id: typeof shop?.id === "string" ? shop.id : "shop",
      name: typeof shop?.name === "string" ? shop.name : "Boutique",
      slug: typeof shop?.slug === "string" ? shop.slug : "",
    },
  };
}

export function parseCart(payload: unknown): CartPayload {
  const root = asRecord(payload);
  const nested = asRecord(root?.cart);
  const raw = root?.items ?? nested?.items;
  const items: CartItem[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const row = asRecord(entry);
      if (!row) continue;
      const product = asProduct(row.product);
      if (!product) continue;
      const quantity = Math.max(1, Number(row.quantity) || 1);
      const productId =
        typeof row.productId === "string" ? row.productId : product.id;
      const existing = items.find((item) => item.productId === productId);
      if (existing) {
        existing.quantity += quantity;
        continue;
      }
      items.push({
        id: typeof row.id === "string" ? row.id : `${productId}-${quantity}`,
        productId,
        quantity,
        product,
      });
    }
  }
  const totalCents =
    typeof root?.totalCents === "number"
      ? root.totalCents
      : items.reduce(
          (sum, item) => sum + item.product.priceCents * item.quantity,
          0,
        );
  const count = items.length;
  return { items, totalCents, count };
}

export function lineImage(item: CartItem) {
  return mediaUrl(item.product.images[0]);
}

export function lineTotal(item: CartItem) {
  return formatMoney(
    item.product.priceCents * item.quantity,
    item.product.currency,
  );
}

export function groupByShop(items: CartItem[]) {
  const map = new Map<string, CartItem[]>();
  for (const item of items) {
    const key = item.product.shop.id;
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return [...map.entries()];
}
