/**
 * Catalogue avatars CREATE AI — mannequins v3 (tee blanc réel) + ghost.
 * Mode `multiply-tee` : l’article teinte le tee déjà porté (plis réels).
 * Mode `silhouette` : découpe SVG sur mannequin nu.
 */

import type {
    AudienceId,
    MannequinFrame,
    MannequinId,
    MannequinShot,
} from "@/src/product-filters";

/** `require()` d’un asset local (compatible expo-image). */
export type AvatarSource = number;

export type AvatarPose = "front" | "threeQuarter" | "handsOnHips" | "fashion";

/** Comment plaquer l’habit sur ce mannequin. */
export type WearMode = "multiply-tee" | "silhouette";

export type GarmentKindKey =
  | "robe"
  | "jupe"
  | "haut"
  | "bas"
  | "veste"
  | "ensemble"
  | "chaussure"
  | "accessoire"
  | "inconnu";

export type BodyZone = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotateDeg: number;
  scaleX: number;
  scaleY: number;
};

export type BodyProfile = Partial<Record<GarmentKindKey, BodyZone>>;

export type Avatar = {
  id: MannequinId;
  name: string;
  audience: AudienceId;
  shot: MannequinShot;
  frame: MannequinFrame;
  pose: AvatarPose;
  source: AvatarSource;
  bodyProfile: BodyProfile;
  /** Mannequin sombre → fond de masque plus foncé. */
  dark: boolean;
  /** Tee déjà porté → multiply ; nu → silhouette SVG. */
  wearMode: WearMode;
  isActive: boolean;
};

export type Mannequin = {
  id: MannequinId;
  label: string;
  audience: AudienceId;
  shot: MannequinShot;
  frame: MannequinFrame;
  pose: AvatarPose;
  source: AvatarSource;
  bodyProfile: BodyProfile;
  dark: boolean;
  wearMode: WearMode;
  isActive: boolean;
};

function zone(
  x: number,
  y: number,
  width: number,
  height: number,
  extra?: Partial<Pick<BodyZone, "rotateDeg" | "scaleX" | "scaleY">>,
): BodyZone {
  return {
    x,
    y,
    width,
    height,
    rotateDeg: extra?.rotateDeg ?? 0,
    scaleX: extra?.scaleX ?? 1,
    scaleY: extra?.scaleY ?? 1,
  };
}

/** Homme face, tee blanc crew (bras derrière) — tissu uniquement. */
const MALE_WHITE_TEE_FRONT: BodyProfile = {
  haut: zone(0.14, 0.3, 0.72, 0.62),
  veste: zone(0.1, 0.26, 0.8, 0.68),
  robe: zone(0.12, 0.28, 0.76, 0.68),
  ensemble: zone(0.1, 0.26, 0.8, 0.7),
  jupe: zone(0.26, 0.72, 0.48, 0.22),
  bas: zone(0.28, 0.7, 0.44, 0.26),
  chaussure: zone(0.34, 0.88, 0.32, 0.1),
  accessoire: zone(0.58, 0.42, 0.28, 0.2, { rotateDeg: -4 }),
  inconnu: zone(0.14, 0.3, 0.72, 0.62),
};

/** Homme A-pose tee blanc (torse + shorts). */
const MALE_WHITE_TEE_APOSE: BodyProfile = {
  haut: zone(0.2, 0.08, 0.6, 0.66),
  veste: zone(0.16, 0.06, 0.68, 0.72),
  robe: zone(0.18, 0.07, 0.64, 0.74),
  ensemble: zone(0.16, 0.06, 0.68, 0.78),
  jupe: zone(0.26, 0.62, 0.48, 0.22),
  bas: zone(0.24, 0.68, 0.52, 0.28),
  chaussure: zone(0.34, 0.9, 0.32, 0.08),
  accessoire: zone(0.6, 0.36, 0.28, 0.2, { rotateDeg: -4 }),
  inconnu: zone(0.2, 0.08, 0.6, 0.66),
};

/** Homme 3/4 casquette tee blanc. */
const MALE_WHITE_TEE_34: BodyProfile = {
  haut: zone(0.26, 0.3, 0.5, 0.48, { rotateDeg: 2 }),
  veste: zone(0.22, 0.26, 0.58, 0.54, { rotateDeg: 2 }),
  robe: zone(0.24, 0.28, 0.54, 0.58),
  ensemble: zone(0.22, 0.26, 0.58, 0.62),
  jupe: zone(0.28, 0.68, 0.44, 0.2),
  bas: zone(0.28, 0.7, 0.44, 0.24),
  chaussure: zone(0.34, 0.9, 0.32, 0.08),
  accessoire: zone(0.58, 0.4, 0.26, 0.18, { rotateDeg: -4 }),
  inconnu: zone(0.26, 0.3, 0.5, 0.48, { rotateDeg: 2 }),
};

/** Femme studio tee oversize clair. */
const FEMALE_LIGHT_TEE: BodyProfile = {
  haut: zone(0.22, 0.24, 0.56, 0.44, { rotateDeg: -2 }),
  veste: zone(0.18, 0.2, 0.64, 0.5, { rotateDeg: -2 }),
  robe: zone(0.2, 0.22, 0.6, 0.58),
  ensemble: zone(0.18, 0.2, 0.64, 0.62),
  jupe: zone(0.28, 0.58, 0.44, 0.24),
  bas: zone(0.3, 0.62, 0.4, 0.3),
  chaussure: zone(0.34, 0.9, 0.32, 0.08),
  accessoire: zone(0.56, 0.36, 0.28, 0.18, { rotateDeg: -4 }),
  inconnu: zone(0.22, 0.24, 0.56, 0.44, { rotateDeg: -2 }),
};

/** Femme corps entier (ghost / full). */
const FEMALE_FULL_FRONT: BodyProfile = {
  haut: zone(0.26, 0.2, 0.48, 0.24),
  veste: zone(0.22, 0.18, 0.56, 0.3),
  robe: zone(0.24, 0.18, 0.52, 0.55),
  ensemble: zone(0.22, 0.17, 0.56, 0.62),
  jupe: zone(0.28, 0.42, 0.44, 0.28),
  bas: zone(0.3, 0.44, 0.4, 0.4),
  chaussure: zone(0.34, 0.86, 0.32, 0.08),
  accessoire: zone(0.56, 0.36, 0.26, 0.18, { rotateDeg: -4 }),
  inconnu: zone(0.26, 0.2, 0.48, 0.26),
};

/** Ghost A-pose — zone = silhouette complète (épaules + bras) que l’habit couvre. */
const MALE_GHOST_TORSO: BodyProfile = {
  haut: zone(0.06, 0.04, 0.88, 0.9),
  veste: zone(0.04, 0.02, 0.92, 0.94),
  robe: zone(0.06, 0.04, 0.88, 0.94),
  ensemble: zone(0.04, 0.02, 0.92, 0.96),
  jupe: zone(0.26, 0.62, 0.48, 0.28),
  bas: zone(0.28, 0.58, 0.44, 0.34),
  chaussure: zone(0.34, 0.86, 0.32, 0.1),
  accessoire: zone(0.58, 0.4, 0.28, 0.22, { rotateDeg: -4 }),
  inconnu: zone(0.06, 0.04, 0.88, 0.9),
};

/**
 * Mannequins v3 — ghost A-pose en premier (portage SVG calibré),
 * puis modèles tee blanc (multiply / plis photo).
 */
export const AVATARS: Avatar[] = [
  {
    id: "m-homme-1",
    name: "Ghost A-pose",
    audience: "homme",
    shot: "full",
    frame: "torso",
    pose: "front",
    source: require("../assets/mannequins/v2-homme-gris.jpg"),
    bodyProfile: MALE_GHOST_TORSO,
    dark: false,
    wearMode: "silhouette",
    isActive: true,
  },
  {
    id: "m-homme-2",
    name: "Homme tee blanc",
    audience: "homme",
    shot: "full",
    frame: "torso",
    pose: "front",
    source: require("../assets/mannequins/v3-homme-blanc-face.jpg"),
    bodyProfile: MALE_WHITE_TEE_FRONT,
    dark: false,
    wearMode: "multiply-tee",
    isActive: true,
  },
  {
    id: "m-homme-3",
    name: "Homme A-pose photo",
    audience: "homme",
    shot: "full",
    frame: "torso",
    pose: "front",
    source: require("../assets/mannequins/v3-homme-tee-blanc.jpg"),
    bodyProfile: MALE_WHITE_TEE_APOSE,
    dark: false,
    wearMode: "multiply-tee",
    isActive: true,
  },
  {
    id: "m-homme-4",
    name: "Homme urbain",
    audience: "homme",
    shot: "full",
    frame: "torso",
    pose: "threeQuarter",
    source: require("../assets/mannequins/v3-homme-blanc-studio.jpg"),
    bodyProfile: MALE_WHITE_TEE_34,
    dark: false,
    wearMode: "multiply-tee",
    isActive: true,
  },
  {
    id: "m-femme-1",
    name: "Femme tee clair",
    audience: "femme",
    shot: "full",
    frame: "full",
    pose: "fashion",
    source: require("../assets/mannequins/v3-femme-tee-studio.jpg"),
    bodyProfile: FEMALE_LIGHT_TEE,
    dark: false,
    wearMode: "multiply-tee",
    isActive: true,
  },
  {
    id: "m-femme-2",
    name: "Femme entière",
    audience: "femme",
    shot: "full",
    frame: "full",
    pose: "front",
    source: require("../assets/mannequins/v2-femme-full.jpg"),
    bodyProfile: FEMALE_FULL_FRONT,
    dark: false,
    wearMode: "silhouette",
    isActive: true,
  },
];

export function avatarToMannequin(a: Avatar): Mannequin {
  return {
    id: a.id,
    label: a.name,
    audience: a.audience,
    shot: a.shot,
    frame: a.frame,
    pose: a.pose,
    source: a.source,
    bodyProfile: a.bodyProfile,
    dark: a.dark,
    wearMode: a.wearMode,
    isActive: a.isActive,
  };
}

export const MANNEQUINS: Mannequin[] = AVATARS.filter((a) => a.isActive).map(
  avatarToMannequin,
);

export function getAvatar(id: MannequinId): Avatar | undefined {
  return AVATARS.find((a) => a.id === id && a.isActive);
}

export function mannequinsForAudience(audience: AudienceId): Mannequin[] {
  const active = MANNEQUINS;
  if (audience === "tous") {
    const picks: Mannequin[] = [];
    const h = active.find((m) => m.audience === "homme");
    const f = active.find((m) => m.audience === "femme");
    if (h) picks.push(h);
    if (f) picks.push(f);
    for (const m of active) {
      if (!picks.some((p) => p.id === m.id)) picks.push(m);
    }
    return picks;
  }
  if (
    audience === "jeune" ||
    audience === "adulte" ||
    audience === "enfant" ||
    audience === "senior"
  ) {
    return active.filter(
      (m) => m.audience === "homme" || m.audience === "femme",
    );
  }
  return active.filter((m) => m.audience === audience);
}

/**
 * Silhouettes SVG (viewBox 0 0 100 120).
 * `shirtSoft` : masque tissu pour multiply (suit le tee photo, pas un sticker).
 * `shirt` : forme tee pour ghost / silhouette.
 */
export const GARMENT_SVG_PATHS = {
  // Masque doux = quasi tout le tee photo (laisse voir col/manches réels au bord)
  shirtSoft:
    "M16 12 C34 2 66 2 84 12 C94 24 96 42 94 58 L90 112 Q50 120 10 112 L6 58 C4 42 6 24 16 12 Z",
  // Tee A-pose : épaule → manche courte le long du bras, ourlet taille
  shirt:
    "M38 12 C47 4 53 4 62 12 L72 20 L86 36 L78 48 L69 38 L67 100 Q50 108 33 100 L31 38 L22 48 L14 36 L28 20 Z",
  dress:
    "M34 12 C42 4 58 4 66 12 L78 18 L97 34 L90 50 L74 42 L82 118 L18 118 L26 42 L10 50 L3 34 L22 18 Z",
  pants: "M30 2 L70 2 L72 30 L98 118 L68 118 L50 48 L32 118 L2 118 L28 30 Z",
  bag: "M28 16 L72 16 L78 104 L22 104 Z",
  shoes: "M16 36 L84 36 L90 84 L10 84 Z",
} as const;
