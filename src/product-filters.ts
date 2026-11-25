/**
 * Catalogue CREATE AI — filtres produits / mannequins / makeup.
 * Accents violet des maquettes : locaux à cet écran (PRD CREATE AI).
 * Mannequins / avatars : voir src/avatars.ts (bodyProfile calibré).
 */

export const CREATE_AI_ACCENT = "#8A5CF5";
export const CREATE_AI_SURFACE = "#1A1A1A";
export const CREATE_AI_BG = "#000000";

export type FilterCategoryId =
  | "mode"
  | "beaute"
  | "tech"
  | "coiffure"
  | "alimentaire";

export type AudienceId =
  | "tous"
  | "homme"
  | "femme"
  | "enfant"
  | "adulte"
  | "jeune"
  | "senior";

export type MannequinId = string;

/** Avatar (visage) ou photo entière (corps). */
export type MannequinShot = "avatar" | "full";

/** Cadre mannequin : corps entier ou buste (torse). */
export type MannequinFrame = "full" | "torso";

export type {
  Avatar,
  AvatarPose,
  BodyProfile,
  BodyZone,
  Mannequin,
} from "@/src/avatars";
export {
  AVATARS,
  MANNEQUINS,
  getAvatar,
  mannequinsForAudience,
} from "@/src/avatars";

export type MakeupStyleId = "natural" | "glam" | "smokey" | "dewy";

/** Looks appliqués en temps réel sur l’article sélectionné. */
export type ProductLookStyleId =
  | "original"
  | "urbain"
  | "studio"
  | "vivid"
  | "cinema"
  | "doux"
  | "noir";

export type ProductLookStyle = {
  id: ProductLookStyleId;
  label: string;
  /** Légères couches rgba (teint clair, pas de boue). */
  overlays: string[];
  /** Dégradé principal du look (plus joli qu’un aplati). */
  gradient?: {
    colors: string[];
    start?: { x: number; y: number };
    end?: { x: number; y: number };
  };
  /** Voile chaud / clair optionnel. */
  lift?: string;
  grayscale?: boolean;
};

export const FILTER_CATEGORIES: {
  id: FilterCategoryId;
  label: string;
  icon: "shirt" | "sparkles" | "phone-portrait" | "cut" | "fast-food";
}[] = [
  { id: "mode", label: "Mode", icon: "shirt" },
  { id: "beaute", label: "Beauté", icon: "sparkles" },
  { id: "tech", label: "Tech", icon: "phone-portrait" },
  { id: "coiffure", label: "Coiffure", icon: "cut" },
  { id: "alimentaire", label: "Alimentaire", icon: "fast-food" },
];

export const AUDIENCE_CHIPS: { id: AudienceId; label: string }[] = [
  { id: "tous", label: "Tous" },
  { id: "homme", label: "Homme" },
  { id: "femme", label: "Femme" },
  { id: "enfant", label: "Enfant" },
  { id: "adulte", label: "Adulte+" },
  { id: "jeune", label: "Jeune" },
  { id: "senior", label: "Senior" },
];

/** Styles proposés à droite — teintes claires, type beauty / lookbook. */
export const PRODUCT_LOOK_STYLES: ProductLookStyle[] = [
  { id: "original", label: "Original", overlays: [] },
  {
    id: "urbain",
    label: "Urbain",
    overlays: ["rgba(120,90,200,0.08)"],
    lift: "rgba(255,255,255,0.06)",
    gradient: {
      colors: [
        "rgba(140,100,220,0.14)",
        "rgba(255,255,255,0.04)",
        "rgba(60,40,120,0.12)",
      ],
      start: { x: 0.2, y: 0 },
      end: { x: 0.9, y: 1 },
    },
  },
  {
    id: "studio",
    label: "Studio",
    overlays: ["rgba(255,248,240,0.12)"],
    lift: "rgba(255,236,214,0.1)",
    gradient: {
      colors: [
        "rgba(255,242,228,0.2)",
        "rgba(255,250,245,0.08)",
        "rgba(255,228,210,0.14)",
      ],
    },
  },
  {
    id: "vivid",
    label: "Vivid",
    overlays: ["rgba(255,255,255,0.04)"],
    gradient: {
      colors: [
        "rgba(255,110,70,0.1)",
        "rgba(255,255,255,0.05)",
        "rgba(70,120,255,0.1)",
      ],
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
    },
  },
  {
    id: "cinema",
    label: "Cinéma",
    overlays: ["rgba(255,255,255,0.03)"],
    gradient: {
      colors: [
        "rgba(255,170,90,0.12)",
        "rgba(30,40,50,0.06)",
        "rgba(20,90,100,0.14)",
      ],
      start: { x: 0.5, y: 0 },
      end: { x: 0.5, y: 1 },
    },
  },
  {
    id: "doux",
    label: "Doux",
    overlays: ["rgba(255,250,246,0.14)"],
    lift: "rgba(255,230,220,0.1)",
    gradient: {
      colors: [
        "rgba(255,228,220,0.16)",
        "rgba(255,248,242,0.1)",
        "rgba(255,236,228,0.12)",
      ],
    },
  },
  {
    id: "noir",
    label: "Noir",
    overlays: ["rgba(18,18,22,0.18)"],
    gradient: {
      colors: ["rgba(0,0,0,0.12)", "rgba(40,40,48,0.08)", "rgba(0,0,0,0.22)"],
    },
    grayscale: true,
  },
];

export const MODE_STYLE_STRIP: {
  id: string;
  label: string;
  image: string;
}[] = [
  {
    id: "coat",
    label: "Manteau",
    image: "https://picsum.photos/seed/ship-mode-1/200/280",
  },
  {
    id: "hoodie",
    label: "Hoodie",
    image: "https://picsum.photos/seed/ship-mode-2/200/280",
  },
  {
    id: "dress",
    label: "Robe",
    image: "https://picsum.photos/seed/ship-mode-3/200/280",
  },
  {
    id: "suit",
    label: "Costume",
    image: "https://picsum.photos/seed/ship-mode-4/200/280",
  },
  {
    id: "kids",
    label: "Enfant",
    image: "https://picsum.photos/seed/ship-mode-5/200/280",
  },
];

export const MAKEUP_STYLES: {
  id: MakeupStyleId;
  label: string;
  prompt: string;
  image: string;
  hero: string;
}[] = [
  {
    id: "natural",
    label: "Natural",
    prompt: "Soft natural makeup, fresh skin, light blush and nude lips.",
    image: "https://picsum.photos/seed/ship-makeup-natural/200/200",
    hero: "https://picsum.photos/seed/ship-makeup-natural-hero/720/900",
  },
  {
    id: "glam",
    label: "Glam",
    prompt: "Full glam makeup with defined brows, highlighter and bold lips.",
    image: "https://picsum.photos/seed/ship-makeup-glam/200/200",
    hero: "https://picsum.photos/seed/ship-makeup-glam-hero/720/900",
  },
  {
    id: "smokey",
    label: "Smokey",
    prompt: "Dark and intense makeup with a dramatic vibe....",
    image: "https://picsum.photos/seed/ship-makeup-smokey/200/200",
    hero: "https://picsum.photos/seed/ship-makeup-smokey-hero/720/900",
  },
  {
    id: "dewy",
    label: "Dewy",
    prompt: "Dewy glowing skin, soft pink tones and luminous finish.",
    image: "https://picsum.photos/seed/ship-makeup-dewy/200/200",
    hero: "https://picsum.photos/seed/ship-makeup-dewy-hero/720/900",
  },
];

export const MAKEUP_PROMPTS_SURPRISE = [
  "Dark and intense makeup with a dramatic vibe....",
  "Soft peachy tones with a radiant dewy finish....",
  "Bold editorial glam with sharp winged liner....",
  "Fresh no-makeup look with subtle flush....",
];

export type ProductFilterSelection = {
  category: FilterCategoryId;
  audience: AudienceId;
  mannequinId: MannequinId;
  lookStyleId: ProductLookStyleId;
  makeupStyleId: MakeupStyleId;
  prompt: string;
  arEnabled: boolean;
  styleStripId: string | null;
};
