function asQty(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function stockSold(product: { soldCount?: number | null }) {
  return asQty(product.soldCount);
}

type StockFields = {
  quantity?: number | null;
  stockRemaining?: number | null;
  soldCount?: number | null;
  status?: string | null;
};

/** Pièces encore en rayon (jamais les ventes). */
export function stockRemaining(product: StockFields) {
  return asQty(product.stockRemaining ?? product.quantity);
}

/** Total initial du rayon : restant + déjà vendu. */
export function stockOriginal(product: {
  quantity?: number | null;
  soldCount?: number | null;
  status?: string | null;
}) {
  const remaining = stockRemaining(product);
  const sold = stockSold(product);
  return Math.max(remaining + sold, remaining, 1);
}

export function productStock(product: {
  quantity?: number | null;
  soldCount?: number | null;
  status?: string | null;
}) {
  return stockRemaining(product);
}

export function productInStock(product: {
  quantity?: number | null;
  soldCount?: number | null;
  status?: string | null;
}) {
  if (product.status && product.status !== "ACTIVE") return false;
  return stockRemaining(product) > 0;
}

export function stockLabel(stock: number) {
  if (stock <= 0) return "Rupture — plus en stock";
  if (stock === 1) return "1 pièce restante";
  return `${stock} pièces en stock`;
}

/** Restant / total, ex. 2/6. */
export function stockFraction(product: {
  quantity?: number | null;
  soldCount?: number | null;
  status?: string | null;
}) {
  const remaining = stockRemaining(product);
  const original = stockOriginal(product);
  return `${remaining}/${original}`;
}

/** Dans le panier : qté choisie / restant rayon, ex. 1/2. */
export function cartStockFraction(
  inCart: number,
  product: {
    quantity?: number | null;
    soldCount?: number | null;
    status?: string | null;
  },
) {
  const remaining = stockRemaining(product);
  const stock = Math.max(remaining, 0);
  return `${Math.max(0, inCart)}/${stock}`;
}

/** >= moitié restante : vert. Sous la moitié : orange. */
export function stockAlertColor(product: {
  quantity?: number | null;
  soldCount?: number | null;
  status?: string | null;
}) {
  const remaining = stockRemaining(product);
  const original = stockOriginal(product);
  if (remaining <= 0) return "#ff8a8a";
  if (remaining * 2 < original) return "#FF7A00";
  return "#00D68F";
}

export function isListableProduct(product: {
  quantity?: number | null;
  soldCount?: number | null;
  status?: string | null;
}) {
  if (product.status && product.status !== "ACTIVE") return false;
  return stockRemaining(product) > 0;
}
