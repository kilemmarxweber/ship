/**
 * Affichage hôte live (alerte + cards feed/Discover) :
 * — boutique présente → « Boutique · Nom »
 * — sinon → nom seul (artiste / admin / owner / créateur)
 */
export type LiveHostKind = "OWNER" | "ADMIN" | "INFLUENCER" | "CREATOR";

export function formatLiveHostLabel(input: {
  userName?: string | null;
  shopName?: string | null;
  hostLabel?: string | null;
}): string {
  if (input.hostLabel?.trim()) return input.hostLabel.trim();
  const name = (input.userName ?? "").trim() || "Créateur";
  const shop = (input.shopName ?? "").trim();
  if (shop && shop.toLowerCase() !== name.toLowerCase()) {
    return `${shop} · ${name}`;
  }
  if (shop) return shop;
  return name;
}
