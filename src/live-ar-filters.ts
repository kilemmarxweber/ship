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

export function isArFilterId(value: string): boolean {
  return AR_FILTERS.some((item) => item.id === value);
}

/** Teint / grade couleur (peut coexister avec un accessoire). */
export function isToneFilter(filter: ArFilter | undefined): boolean {
  if (!filter || filter.id === "none") return false;
  return (
    filter.type === "color" ||
    filter.type === "beauty" ||
    filter.type === "distortion"
  );
}

/** Accessoire emoji / animation (peut coexister avec un teint). */
export function isPropFilter(filter: ArFilter | undefined): boolean {
  if (!filter || filter.id === "none") return false;
  return filter.type === "overlay" || filter.type === "animation";
}

export type LiveFilterCombo = {
  /** Grade teint : studio, doux, vivid… ou null = aucun. */
  tone: string | null;
  /** Accessoire : glasses, crown… ou null = aucun. */
  prop: string | null;
};

/** Encode `studio+glasses` (teint + accessoire). */
export function encodeLiveFilterCombo(combo: LiveFilterCombo): string {
  const tone = combo.tone && combo.tone !== "none" ? combo.tone : null;
  const prop = combo.prop && combo.prop !== "none" ? combo.prop : null;
  if (!tone && !prop) return "none";
  if (tone && prop) return `${tone}+${prop}`;
  return tone ?? prop ?? "none";
}

/** Parse id simple ou combo `tone+prop`. */
export function parseLiveFilterCombo(
  raw: string | null | undefined,
): LiveFilterCombo {
  if (!raw || raw === "none" || raw === "naturel" || raw === "natural") {
    return { tone: null, prop: null };
  }
  const parts = raw
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { tone: null, prop: null };
  if (parts.length === 1) {
    const only = parts[0]!;
    const filter = arFilterById(only);
    if (isPropFilter(filter)) return { tone: null, prop: only };
    if (isToneFilter(filter) || isArFilterId(only) || only.length > 0) {
      return { tone: only === "naturel" ? null : only, prop: null };
    }
    return { tone: null, prop: null };
  }
  const [a, b] = parts;
  const fa = arFilterById(a!);
  const fb = arFilterById(b!);
  if (isToneFilter(fa) && isPropFilter(fb)) return { tone: a!, prop: b! };
  if (isPropFilter(fa) && isToneFilter(fb)) return { tone: b!, prop: a! };
  // Compat : premier = teint, second = accessoire
  return { tone: a!, prop: b! };
}

export function isLiveFilterComboId(value: string): boolean {
  if (value === "none" || value === "naturel" || value === "natural")
    return true;
  if (isArFilterId(value)) return true;
  const combo = parseLiveFilterCombo(value);
  if (combo.tone && !isArFilterId(combo.tone)) return false;
  if (combo.prop && !isArFilterId(combo.prop)) return false;
  return Boolean(combo.tone || combo.prop);
}

/**
 * Toggle intelligent : teint remplace teint, accessoire remplace/toggle accessoire.
 * `none` remet tout à zéro.
 */
export function applyLiveFilterPick(
  current: LiveFilterCombo,
  id: string,
): LiveFilterCombo {
  if (id === "none" || id === "naturel" || id === "natural") {
    return { tone: null, prop: null };
  }
  const filter = arFilterById(id);
  if (isToneFilter(filter)) {
    return {
      tone: current.tone === id ? null : id,
      prop: current.prop,
    };
  }
  if (isPropFilter(filter)) {
    return {
      tone: current.tone,
      prop: current.prop === id ? null : id,
    };
  }
  return { tone: id, prop: current.prop };
}

/** Map AR id → legacy LiveLookId for color overlays */
export function colorLookFromArId(id: string): string | null {
  const filter = arFilterById(id);
  if (!filter) return null;
  if (filter.id === "none") return "naturel";
  return filter.colorLook ?? null;
}
