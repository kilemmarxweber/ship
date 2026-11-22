/**
 * Catalogue filtres AR Live / Studio (modèle PDR).
 * Looks couleur historiques restent valides pour le data-channel.
 */

export type ArFilterType =
  | "overlay"
  | "beauty"
  | "color"
  | "distortion"
  | "animation";

export type ArFilterAnchor =
  | "head"
  | "eyes"
  | "nose"
  | "face"
  | "ears"
  | "background";

export type ArFilter = {
  id: string;
  name: string;
  category: string;
  emoji: string;
  type: ArFilterType;
  anchor: ArFilterAnchor;
  scale: number;
  enabled: boolean;
  /** Legacy live look id when type=color */
  colorLook?: string;
};

export const AR_FILTERS: ArFilter[] = [
  {
    id: "none",
    name: "Aucun",
    category: "normal",
    emoji: "🚫",
    type: "overlay",
    anchor: "face",
    scale: 1,
    enabled: true,
  },
  {
    id: "naturel",
    name: "Naturel",
    category: "couleurs",
    emoji: "✨",
    type: "color",
    anchor: "background",
    scale: 1,
    enabled: true,
    colorLook: "naturel",
  },
  {
    id: "studio",
    name: "Studio",
    category: "beauté",
    emoji: "🤍",
    type: "beauty",
    anchor: "face",
    scale: 1,
    enabled: true,
    colorLook: "studio",
  },
  {
    id: "doux",
    name: "Doux",
    category: "beauté",
    emoji: "🌸",
    type: "beauty",
    anchor: "face",
    scale: 1,
    enabled: true,
    colorLook: "doux",
  },
  {
    id: "vivid",
    name: "Vivid",
    category: "couleurs",
    emoji: "🌈",
    type: "color",
    anchor: "background",
    scale: 1,
    enabled: true,
    colorLook: "vivid",
  },
  {
    id: "cinema",
    name: "Cinéma",
    category: "couleurs",
    emoji: "🎬",
    type: "color",
    anchor: "background",
    scale: 1,
    enabled: true,
    colorLook: "cinema",
  },
  {
    id: "noir",
    name: "Noir",
    category: "couleurs",
    emoji: "⬛",
    type: "color",
    anchor: "background",
    scale: 1,
    enabled: true,
    colorLook: "noir",
  },
  {
    id: "crown",
    name: "Couronne",
    category: "chapeaux",
    emoji: "👑",
    type: "overlay",
    anchor: "head",
    scale: 1.45,
    enabled: true,
  },
  {
    id: "cap",
    name: "Casquette",
    category: "chapeaux",
    emoji: "🧢",
    type: "overlay",
    anchor: "head",
    scale: 1.4,
    enabled: true,
  },
  {
    id: "glasses",
    name: "Lunettes",
    category: "lunettes",
    emoji: "🕶️",
    type: "overlay",
    anchor: "eyes",
    scale: 1.55,
    enabled: true,
  },
  {
    id: "earrings",
    name: "Boucles",
    category: "bijoux",
    emoji: "💎",
    type: "overlay",
    anchor: "ears",
    scale: 1.05,
    enabled: true,
  },
  {
    id: "cat",
    name: "Chat",
    category: "animaux",
    emoji: "🐱",
    type: "overlay",
    anchor: "head",
    scale: 1.5,
    enabled: true,
  },
  {
    id: "heart",
    name: "Cœurs",
    category: "emojis",
    emoji: "💕",
    type: "animation",
    anchor: "eyes",
    scale: 1,
    enabled: true,
  },
  {
    id: "star",
    name: "Étoiles",
    category: "emojis",
    emoji: "⭐",
    type: "animation",
    anchor: "head",
    scale: 1,
    enabled: true,
  },
  {
    id: "sparkle",
    name: "Sparkle",
    category: "animation",
    emoji: "✨",
    type: "animation",
    anchor: "face",
    scale: 1,
    enabled: true,
  },
  {
    id: "blush",
    name: "Blush",
    category: "beauté",
    emoji: "😊",
    type: "beauty",
    anchor: "face",
    scale: 1,
    enabled: true,
  },
];

export function arFilterById(id: string): ArFilter | undefined {
  return AR_FILTERS.find((item) => item.id === id);
}

/** Stickers / blush suivent le visage. Les grades couleur n’en ont pas besoin. */
export function filterNeedsFacePose(id: string) {
  const filter = arFilterById(id);
  if (!filter || filter.id === "none" || filter.type === "color") return false;
  if (filter.id === "blush") return true;
  return filter.type === "overlay" || filter.type === "animation";
}

export function isArFilterId(value: string): boolean {
  return AR_FILTERS.some((item) => item.id === value);
}

/** Map AR id → legacy LiveLookId for color overlays */
export function colorLookFromArId(id: string): string | null {
  const filter = arFilterById(id);
  if (!filter) return null;
  if (filter.id === "none") return "naturel";
  return filter.colorLook ?? null;
}
