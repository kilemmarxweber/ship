export function feedSnapKey(token: string | null | undefined) {
  return `feed.foryou:${token ?? "guest"}`;
}

export function cartSnapKey(token: string | null | undefined) {
  return `cart:${token ?? "guest"}`;
}

export function inboxSnapKey(token: string | null | undefined) {
  return `inbox:${token ?? "guest"}`;
}

export function commentsSnapKey(productId: string) {
  return `comments:${productId}`;
}

export function threadSnapKey(id: string) {
  return `thread:${id}`;
}

export function inboxQueryKey(token: string | null | undefined) {
  return ["inbox", token ?? "guest"] as const;
}

export function feedQueryKey(
  token: string | null | undefined,
  tab = "foryou",
) {
  return ["feed", tab, token ?? "guest"] as const;
}
