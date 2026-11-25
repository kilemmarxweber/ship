/**
 * Pipeline essayage virtuel CREATE AI (client).
 *
 * - Détecte le type d’habit (robe, haut, bas…).
 * - Ancre l’habit sur le TORSE (jamais sur le visage).
 * - Uniquement photos corps entier (`shot: "full"`) pour porter un vêtement.
 *
 * Prévisualisation géométrique — pas un VTON génératif cloud.
 */

import type { BodyProfile, BodyZone } from "@/src/avatars";
import type {
    AudienceId,
    MannequinFrame,
    MannequinShot,
} from "@/src/product-filters";
import { hintFromSellCategory } from "@/src/product-image-intel";

export type GarmentKind =
  | "robe"
  | "jupe"
  | "haut"
  | "bas"
  | "veste"
  | "ensemble"
  | "chaussure"
  | "accessoire"
  | "inconnu";

/** Aligné plan VTON §6.3 */
export type GarmentPhotoType = "flat-lay" | "model";

export type GarmentSilhouette = "shirt" | "dress" | "pants" | "shoes" | "bag";

export type GarmentDetection = {
  kind: GarmentKind;
  label: string;
  confidence: number;
  silhouette: GarmentSilhouette;
  photoType: GarmentPhotoType;
  sourceCrop: { x: number; y: number; width: number; height: number };
  reasons: string[];
};

/** Zone d’ancrage TORSE (0–1). Le visage reste au-dessus (~0–0.22). */
export type BodyAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotateDeg: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  borderRadius: number;
};

/** Cadre 0–1 où l’habit est posé sur la scène (référence). */
export type StageRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TryOnLayout = {
  garment: GarmentDetection;
  /** @deprecated zone habit → corps ; préférer garmentFrame + mannequinFit */
  anchor: BodyAnchor;
  /** Position de l’habit sur la scène (référence). */
  garmentFrame: StageRect;
  /**
   * Position du mannequin pour que sa zone corps
   * coïncide avec garmentFrame (le mannequin suit l’habit).
   */
  mannequinFit: StageRect;
  shade: string;
  fitHint: string;
  /** false si avatar / portrait — on ne plaque pas l’habit sur le visage. */
  canWear: boolean;
  /** contain (flat-lay) vs cover (model). */
  garmentFit: "contain" | "cover";
};

const GARMENT_LABELS: Record<GarmentKind, string> = {
  robe: "Robe",
  jupe: "Jupe",
  haut: "Haut",
  bas: "Bas",
  veste: "Veste",
  ensemble: "Ensemble",
  chaussure: "Chaussures",
  accessoire: "Accessoire",
  inconnu: "Article",
};

const KIND_RULES: { kind: GarmentKind; re: RegExp; weight: number }[] = [
  { kind: "robe", re: /\b(robe|dress|gown|maxi)\b/i, weight: 0.92 },
  { kind: "jupe", re: /\b(jupe|skirt)\b/i, weight: 0.88 },
  {
    kind: "veste",
    re: /\b(veste|blazer|manteau|coat|jacket|hoodie|sweat)\b/i,
    weight: 0.86,
  },
  {
    kind: "haut",
    re: /\b(t-?shirt|tee|chemise|shirt|polo|top|haut|pull|sweater|blouse|oversize)\b/i,
    weight: 0.9,
  },
  {
    kind: "bas",
    re: /\b(pantalon|jean|jeans|short|legging|trousers?|pants?)\b/i,
    weight: 0.88,
  },
  {
    kind: "ensemble",
    re: /\b(ensemble|combinaison|costume|suit|set|uniforme)\b/i,
    weight: 0.85,
  },
  {
    kind: "chaussure",
    re: /\b(chaussure|basket|sneaker|talon|botte|sandale|shoe|boot)\b/i,
    weight: 0.9,
  },
  {
    kind: "accessoire",
    re: /\b(sac|bag|chapeau|hat|lunette|bijou|ceinture|écharpe)\b/i,
    weight: 0.82,
  },
];

function silhouetteFor(kind: GarmentKind): GarmentSilhouette {
  switch (kind) {
    case "robe":
    case "ensemble":
      return "dress";
    case "jupe":
    case "bas":
      return "pants";
    case "chaussure":
      return "shoes";
    case "accessoire":
      return "bag";
    default:
      return "shirt";
  }
}

/**
 * Un vêtement (haut/robe/…) ne se porte que sur un plan corps entier.
 * Les avatars / gros plans visage restent sans overlay habit.
 */
export function canWearGarment(
  shot: MannequinShot,
  kind: GarmentKind,
): boolean {
  if (shot === "avatar") {
    return kind === "accessoire";
  }
  return true;
}

/**
 * Détecte flat-lay vs model (plan §6.3).
 * Défaut produit e-commerce : flat-lay.
 */
export function detectGarmentPhotoType(input: {
  title?: string | null;
  category?: string | null;
  imageRatio?: number | null;
}): GarmentPhotoType {
  const blob = `${input.title ?? ""} ${input.category ?? ""}`.toLowerCase();
  if (/\b(porté|portee|on.?model|mannequin|worn|lookbook)\b/i.test(blob)) {
    return "model";
  }
  if (/\b(plat|flat.?lay|packshot|produit seul|ghost)\b/i.test(blob)) {
    return "flat-lay";
  }
  // Portrait très long → souvent porté ; sinon flat-lay catalogue
  const ratio = input.imageRatio;
  if (ratio != null && Number.isFinite(ratio) && ratio < 0.55) {
    return "model";
  }
  return "flat-lay";
}

export function detectGarment(input: {
  title?: string | null;
  category?: string | null;
  imageRatio?: number | null;
}): GarmentDetection {
  const title = (input.title ?? "").trim();
  const category = (input.category ?? "").trim();
  const blob = `${title} ${category}`.trim();
  const reasons: string[] = [];

  let best: { kind: GarmentKind; confidence: number } | null = null;
  for (const rule of KIND_RULES) {
    if (rule.re.test(blob)) {
      if (!best || rule.weight > best.confidence) {
        best = { kind: rule.kind, confidence: rule.weight };
        reasons.push(`mot-clé « ${rule.kind} »`);
      }
    }
  }

  if (!best && category) {
    const hint = hintFromSellCategory(category);
    const mapped: Record<string, GarmentKind> = {
      robes: "robe",
      hauts: "haut",
      chaussures: "chaussure",
      sacs: "accessoire",
      bijoux: "accessoire",
      divers: "inconnu",
    };
    best = { kind: mapped[hint] ?? "inconnu", confidence: 0.55 };
    reasons.push(`catégorie « ${hint} »`);
  }

  const ratio = input.imageRatio ?? null;
  if (!best && ratio != null && Number.isFinite(ratio)) {
    if (ratio < 0.72) {
      best = { kind: "robe", confidence: 0.48 };
      reasons.push("ratio portrait long");
    } else if (ratio > 1.15) {
      best = { kind: "chaussure", confidence: 0.42 };
      reasons.push("ratio paysage");
    } else {
      best = { kind: "haut", confidence: 0.45 };
      reasons.push("ratio produit standard");
    }
  }

  if (!best) {
    best = { kind: "haut", confidence: 0.35 };
    reasons.push("défaut haut");
  }

  const photoType = detectGarmentPhotoType(input);
  reasons.push(photoType === "flat-lay" ? "photo à plat" : "photo portée");

  return {
    kind: best.kind,
    label: GARMENT_LABELS[best.kind],
    confidence: best.confidence,
    silhouette: silhouetteFor(best.kind),
    photoType,
    sourceCrop: sourceCropForKind(best.kind, photoType),
    reasons,
  };
}

function sourceCropForKind(
  kind: GarmentKind,
  photoType: GarmentPhotoType,
): GarmentDetection["sourceCrop"] {
  // Model : crop torse plus serré ; flat-lay : presque toute l’image produit
  if (photoType === "model") {
    switch (kind) {
      case "robe":
      case "ensemble":
        return { x: 0.18, y: 0.12, width: 0.64, height: 0.75 };
      case "haut":
      case "veste":
        return { x: 0.2, y: 0.14, width: 0.6, height: 0.55 };
      default:
        return { x: 0.18, y: 0.15, width: 0.64, height: 0.65 };
    }
  }
  switch (kind) {
    case "robe":
    case "ensemble":
      return { x: 0.1, y: 0.08, width: 0.8, height: 0.88 };
    case "jupe":
    case "bas":
      return { x: 0.12, y: 0.08, width: 0.76, height: 0.84 };
    case "veste":
    case "haut":
      // Saute le cintre : cadre = tissu porté
      return { x: 0.12, y: 0.2, width: 0.76, height: 0.72 };
    case "chaussure":
      return { x: 0.14, y: 0.2, width: 0.72, height: 0.58 };
    case "accessoire":
      return { x: 0.16, y: 0.16, width: 0.68, height: 0.68 };
    default:
      return { x: 0.12, y: 0.16, width: 0.76, height: 0.76 };
  }
}

/**
 * Ancres corps entier — mannequin fashion (tête → pieds).
 * Habit sous le cou (~y ≥ 0.18).
 */
const BASE_ANCHORS_FULL: Record<
  GarmentKind,
  Omit<BodyAnchor, "opacity" | "borderRadius">
> = {
  haut: {
    x: 0.26,
    y: 0.2,
    width: 0.48,
    height: 0.28,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
  },
  veste: {
    x: 0.22,
    y: 0.18,
    width: 0.56,
    height: 0.34,
    rotateDeg: 0,
    scaleX: 1.02,
    scaleY: 1,
  },
  robe: {
    x: 0.24,
    y: 0.18,
    width: 0.52,
    height: 0.58,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
  },
  ensemble: {
    x: 0.22,
    y: 0.17,
    width: 0.56,
    height: 0.64,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
  },
  jupe: {
    x: 0.28,
    y: 0.42,
    width: 0.44,
    height: 0.28,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
  },
  bas: {
    x: 0.3,
    y: 0.44,
    width: 0.4,
    height: 0.4,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
  },
  chaussure: {
    x: 0.34,
    y: 0.84,
    width: 0.32,
    height: 0.1,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
  },
  accessoire: {
    x: 0.56,
    y: 0.36,
    width: 0.26,
    height: 0.2,
    rotateDeg: -4,
    scaleX: 1,
    scaleY: 1,
  },
  inconnu: {
    x: 0.26,
    y: 0.22,
    width: 0.48,
    height: 0.3,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
  },
};

/** Ancres buste / torse (mannequin sans jambes). */
const BASE_ANCHORS_TORSO: Record<
  GarmentKind,
  Omit<BodyAnchor, "opacity" | "borderRadius">
> = {
  haut: {
    x: 0.18,
    y: 0.14,
    width: 0.64,
    height: 0.58,
    rotateDeg: 0,
    scaleX: 1.04,
    scaleY: 1,
  },
  veste: {
    x: 0.14,
    y: 0.1,
    width: 0.72,
    height: 0.7,
    rotateDeg: 0,
    scaleX: 1.06,
    scaleY: 1,
  },
  robe: {
    x: 0.16,
    y: 0.12,
    width: 0.68,
    height: 0.78,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
  },
  ensemble: {
    x: 0.14,
    y: 0.1,
    width: 0.72,
    height: 0.82,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
  },
  jupe: {
    x: 0.22,
    y: 0.62,
    width: 0.56,
    height: 0.3,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
  },
  bas: {
    x: 0.24,
    y: 0.58,
    width: 0.52,
    height: 0.36,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
  },
  chaussure: {
    x: 0.3,
    y: 0.82,
    width: 0.4,
    height: 0.14,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
  },
  accessoire: {
    x: 0.55,
    y: 0.35,
    width: 0.3,
    height: 0.28,
    rotateDeg: -4,
    scaleX: 1,
    scaleY: 1,
  },
  inconnu: {
    x: 0.18,
    y: 0.14,
    width: 0.64,
    height: 0.58,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
  },
};

type AudienceMorph = {
  scale: number;
  dy: number;
  scaleX: number;
  label: string;
};

const AUDIENCE_MORPH: Record<AudienceId, AudienceMorph> = {
  tous: { scale: 1, dy: 0, scaleX: 1, label: "standard" },
  homme: { scale: 1.04, dy: 0.01, scaleX: 1.08, label: "épaule homme" },
  femme: { scale: 0.96, dy: 0, scaleX: 0.94, label: "silhouette femme" },
  enfant: { scale: 0.78, dy: -0.02, scaleX: 0.92, label: "proportion enfant" },
  adulte: { scale: 1, dy: 0, scaleX: 1, label: "adulte" },
  jeune: { scale: 0.97, dy: 0, scaleX: 1, label: "jeune" },
  senior: { scale: 1.02, dy: 0.015, scaleX: 1.04, label: "senior" },
};

function zoneToAnchor(
  zone: BodyZone,
  kind: GarmentKind,
  morph: AudienceMorph,
  frame: MannequinFrame,
  /** Profil déjà calibré sur la photo → pas de morph audience. */
  calibrated = false,
): BodyAnchor {
  let { x, y, width, height, rotateDeg, scaleX, scaleY } = zone;

  if (!calibrated) {
    const cx = x + width / 2;
    const cy = y + height / 2;
    width *= morph.scale * morph.scaleX;
    height *= morph.scale;
    x = cx - width / 2;
    y = cy - height / 2 + morph.dy;
    scaleX *= morph.scaleX;
  }

  if (frame === "full" && kind !== "accessoire" && kind !== "chaussure") {
    y = Math.max(0.14, y);
  }

  width = clamp(width, 0.22, 0.9);
  height = clamp(height, 0.08, 0.9);
  x = clamp(x, 0.02, 1 - width - 0.02);
  y = clamp(y, 0.02, 1 - height - 0.02);

  const isTop = kind === "haut" || kind === "veste" || kind === "inconnu";

  return {
    x,
    y,
    width,
    height,
    rotateDeg,
    scaleX,
    scaleY,
    opacity: isTop ? 0.9 : 0.92,
    borderRadius: isTop ? 18 : kind === "robe" ? 24 : 14,
  };
}

export function bodyAnchorFor(opts: {
  kind: GarmentKind;
  audience: AudienceId;
  shot: MannequinShot;
  frame?: MannequinFrame;
  /** Profil calibré du mannequin (prioritaire). */
  bodyProfile?: BodyProfile | null;
}): BodyAnchor {
  const frame = opts.frame ?? "full";
  const morph = AUDIENCE_MORPH[opts.audience] ?? AUDIENCE_MORPH.tous;
  const fromProfile = opts.bodyProfile?.[opts.kind];
  if (fromProfile) {
    return zoneToAnchor(fromProfile, opts.kind, morph, frame, true);
  }

  const table = frame === "torso" ? BASE_ANCHORS_TORSO : BASE_ANCHORS_FULL;
  return zoneToAnchor(table[opts.kind], opts.kind, morph, frame, false);
}

/**
 * Cadre scène de l’habit (l’habit dicte la pose).
 * Flat-lay : grand cadre central ; model : un peu plus serré.
 */
export function garmentFrameFor(
  garment: GarmentDetection,
  frame: MannequinFrame = "full",
): StageRect {
  const crop = garment.sourceCrop;
  // Légère marge pour respirer dans le hero
  const pad = garment.photoType === "flat-lay" ? 0.04 : 0.06;
  let x = clamp(crop.x + pad * 0.5, 0.04, 0.3);
  let y = clamp(crop.y + pad * 0.5, 0.02, 0.25);
  let width = clamp(crop.width - pad, 0.45, 0.92);
  let height = clamp(crop.height - pad, 0.4, 0.92);

  if (
    frame === "torso" &&
    (garment.kind === "haut" || garment.kind === "veste")
  ) {
    // Cadre large : le mannequin (bras inclus) se glisse sous le tee
    x = 0.06;
    y = garment.photoType === "flat-lay" ? 0.1 : 0.06;
    width = 0.88;
    height = garment.photoType === "flat-lay" ? 0.78 : 0.84;
  }

  x = clamp(x, 0.02, 1 - width - 0.02);
  y = clamp(y, 0.02, 1 - height - 0.02);
  return { x, y, width, height };
}

/**
 * Place le mannequin pour que bodyZone (sur l’image mannequin)
 * tombe exactement sur garmentFrame (sur la scène).
 * → le mannequin suit la position de l’habit.
 */
export function mannequinFitToGarment(
  garmentFrame: StageRect,
  bodyZone: StageRect,
): StageRect {
  const bw = Math.max(bodyZone.width, 0.15);
  const bh = Math.max(bodyZone.height, 0.15);
  // Mapping exact : coins de bodyZone → coins de garmentFrame
  // (le mannequin se déplace / scale pour suivre l’habit)
  const width = clamp(garmentFrame.width / bw, 0.4, 1.85);
  const height = clamp(garmentFrame.height / bh, 0.4, 1.85);
  const x = garmentFrame.x - bodyZone.x * width;
  const y = garmentFrame.y - bodyZone.y * height;
  return { x, y, width, height };
}

export function computeTryOnLayout(input: {
  title?: string | null;
  category?: string | null;
  imageRatio?: number | null;
  audience: AudienceId;
  shot: MannequinShot;
  frame?: MannequinFrame;
  bodyProfile?: BodyProfile | null;
}): TryOnLayout {
  const garment = detectGarment({
    title: input.title,
    category: input.category,
    imageRatio: input.imageRatio,
  });
  const morph = AUDIENCE_MORPH[input.audience] ?? AUDIENCE_MORPH.tous;
  const canWear = canWearGarment(input.shot, garment.kind);
  const frame = input.frame ?? "full";
  const anchor = bodyAnchorFor({
    kind: garment.kind,
    audience: input.audience,
    shot: input.shot,
    frame,
    bodyProfile: input.bodyProfile,
  });

  const garmentFrame = garmentFrameFor(garment, frame);
  const bodyZone: StageRect = {
    x: anchor.x,
    y: anchor.y,
    width: anchor.width,
    height: anchor.height,
  };
  let mannequinFit = mannequinFitToGarment(garmentFrame, bodyZone);
  // Flat-lay : mannequin un peu plus grand + remonté pour remplir le tee
  if (
    garment.photoType === "flat-lay" &&
    (garment.kind === "haut" ||
      garment.kind === "veste" ||
      garment.kind === "robe")
  ) {
    const cx = mannequinFit.x + mannequinFit.width / 2;
    const cy = mannequinFit.y + mannequinFit.height / 2;
    const w = mannequinFit.width * 1.08;
    const h = mannequinFit.height * 1.08;
    mannequinFit = {
      x: cx - w / 2,
      y: cy - h / 2 - 0.08,
      width: w,
      height: h,
    };
  }

  const photoLabel = garment.photoType === "flat-lay" ? "à plat" : "portée";

  return {
    garment,
    anchor,
    garmentFrame,
    mannequinFit,
    shade:
      garment.photoType === "flat-lay"
        ? "rgba(20,16,12,0.16)"
        : "rgba(20,16,12,0.22)",
    fitHint: canWear
      ? `${garment.label} · mannequin aligné · ${photoLabel}`
      : `${garment.label} · mannequin entier requis`,
    canWear,
    garmentFit: garment.photoType === "flat-lay" ? "contain" : "cover",
  };
}

export function thumbAnchorFor(
  kind: GarmentKind,
  audience: AudienceId,
  shot: MannequinShot,
  frame?: MannequinFrame,
  bodyProfile?: BodyProfile | null,
): BodyAnchor {
  const a = bodyAnchorFor({ kind, audience, shot, frame, bodyProfile });
  return { ...a, opacity: 0.75, borderRadius: 10 };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function garmentKindLabel(kind: GarmentKind) {
  return GARMENT_LABELS[kind];
}
