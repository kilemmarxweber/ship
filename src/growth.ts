export const INFLUENCER_FOLLOWERS = 2_000;

export type GrowthBadge = {
  kind: "ACTIVE" | "INFLUENCER" | string;
  active?: boolean;
  progress?: number;
  target?: number;
  id?: string;
  title?: string;
};

export type GrowthMission = {
  key: string;
  target: number;
  progress: number;
  completed: boolean;
};

export type LeaderboardRow = {
  rank: number;
  name: string;
  interactions: number;
  activeDays: number;
};

export const MISSION_LABEL: Record<string, string> = {
  visit_shops: "Visiter 5 boutiques",
  discover_categories: "Explorer 3 catégories",
  share_product: "Partager 1 produit",
  useful_comment: "Laisser un commentaire utile",
};

export function badgeLabel(badge: GrowthBadge | null | undefined) {
  if (badge?.kind === "INFLUENCER") return "Influenceur\u00A0";
  if (badge?.kind === "ACTIVE") return "Actif";
  return badge?.title?.trim() || "Badge";
}

export function badgeKey(badge: GrowthBadge | null | undefined, index: number) {
  return badge?.kind || badge?.id || badge?.title || `badge-${index}`;
}
