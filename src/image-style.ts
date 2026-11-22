import {
    encodeSlideMotion,
    type CatalogTrack,
    type SlideMotion,
} from "@/src/soundtrack";

export type ImageStyleId =
  | "mode"
  | "beaute"
  | "tech"
  | "aliment"
  | "maison"
  | "sport"
  | "lifestyle"
  | "auto"
  | "neutre";

export type VideoStyleModel = {
  id: string;
  label: string;
  detail: string;
  motions: readonly SlideMotion[];
};

export type StyleRead = {
  style: ImageStyleId;
  label: string;
  detail: string;
  soundMood: string;
  soundQuery: string;
  stillCount: number;
  videoCount: number;
  signature: string;
  modelId: string;
};

const STYLES: Record<
  ImageStyleId,
  {
    label: string;
    detail: string;
    soundMood: string;
    soundQuery: string;
    modelId: string;
  }
> = {
  mode: {
    label: "Mode",
    detail: "Portrait, vêtement ou allure",
    soundMood: "afro pop mode",
    soundQuery: "afro pop",
    modelId: "defile",
  },
  beaute: {
    label: "Beauté",
    detail: "Soin, maquillage, gros plan",
    soundMood: "rnb chill beauté",
    soundQuery: "rnb chill",
    modelId: "gros-plan",
  },
  tech: {
    label: "Tech",
    detail: "Produit net, plan serré",
    soundMood: "electro tech",
    soundQuery: "electronic",
    modelId: "vitrine",
  },
  aliment: {
    label: "Aliment",
    detail: "Plat, couleur chaude",
    soundMood: "soul acoustic",
    soundQuery: "soul",
    modelId: "ambiance",
  },
  maison: {
    label: "Maison",
    detail: "Intérieur, objet posé",
    soundMood: "jazz calme",
    soundQuery: "jazz",
    modelId: "ambiance",
  },
  sport: {
    label: "Sport",
    detail: "Mouvement, énergie",
    soundMood: "hip hop sport",
    soundQuery: "hip hop",
    modelId: "story",
  },
  lifestyle: {
    label: "Lifestyle",
    detail: "Scène large, quotidien",
    soundMood: "pop chill",
    soundQuery: "pop",
    modelId: "vitrine",
  },
  auto: {
    label: "Auto",
    detail: "Paysage ou véhicule",
    soundMood: "cinematic drive",
    soundQuery: "cinematic",
    modelId: "defile",
  },
  neutre: {
    label: "Produit",
    detail: "Photo catalogue",
    soundMood: "pop",
    soundQuery: "pop",
    modelId: "vitrine",
  },
};

/** Modèles d’animation. Ils ne s’appliquent qu’aux photos. */
export const VIDEO_STYLE_MODELS: readonly VideoStyleModel[] = [
  {
    id: "vitrine",
    label: "Vitrine",
    detail: "Zoom avant lent",
    motions: ["zoom-in"],
  },
  {
    id: "defile",
    label: "Défilé",
    detail: "Travelling gauche et droit",
    motions: ["pan-left", "pan-right"],
  },
  {
    id: "gros-plan",
    label: "Gros plan",
    detail: "Zoom avant puis arrière",
    motions: ["zoom-in", "zoom-out"],
  },
  {
    id: "ambiance",
    label: "Ambiance",
    detail: "Zoom arrière, puis montée",
    motions: ["zoom-out", "pan-up"],
  },
  {
    id: "story",
    label: "Story",
    detail: "Montée verticale",
    motions: ["pan-up", "zoom-in"],
  },
];

const KEYWORDS: { style: ImageStyleId; words: string[] }[] = [
  {
    style: "beaute",
    words: [
      "beaut",
      "makeup",
      "maquillage",
      "skin",
      "glow",
      "soin",
      "parfum",
      "coiff",
    ],
  },
  {
    style: "mode",
    words: [
      "mode",
      "robe",
      "dress",
      "shirt",
      "chemise",
      "shoe",
      "chaussure",
      "sac",
      "look",
      "fashion",
    ],
  },
  {
    style: "aliment",
    words: ["food", "aliment", "plat", "repas", "restaurant", "boisson"],
  },
  {
    style: "tech",
    words: ["phone", "tech", "laptop", "gadget", "écran", "ecran"],
  },
  {
    style: "maison",
    words: [
      "maison",
      "home",
      "deco",
      "déco",
      "meuble",
      "interieur",
      "intérieur",
    ],
  },
  { style: "sport", words: ["sport", "gym", "fitness", "ball", "run"] },
  { style: "auto", words: ["car", "auto", "voiture", "moto", "drive"] },
  { style: "lifestyle", words: ["lifestyle", "voyage", "travel", "street"] },
];

const CATEGORY_STYLE: Record<string, ImageStyleId> = {
  tech: "tech",
  mode: "mode",
  aliment: "aliment",
  beauté: "beaute",
  beaute: "beaute",
  coiffure: "beaute",
  maison: "maison",
  gaming: "tech",
  auto: "auto",
  livres: "maison",
  sport: "sport",
};

function isStill(url: string) {
  const clean = url.split("?")[0]?.split("#")[0] ?? url;
  return !/\.(mp4|webm|mov|m4v|mkv|avi|3gp)$/i.test(clean);
}

function blobOf(urls: string[], title?: string, category?: string) {
  return `${urls.join(" ")} ${title ?? ""} ${category ?? ""}`.toLowerCase();
}

export function videoStyleModel(id: string) {
  return (
    VIDEO_STYLE_MODELS.find((model) => model.id === id) ??
    VIDEO_STYLE_MODELS[0]!
  );
}

export function detectImageStyle(input: {
  urls: string[];
  category?: string;
  title?: string;
  ratio?: number;
  style?: ImageStyleId;
}): StyleRead | null {
  const urls = input.urls
    .map((url) => url.trim())
    .filter(Boolean)
    .slice(0, 12);
  const stills = urls.filter(isStill);
  const videoCount = urls.length - stills.length;
  if (!urls.length) return null;
  if (input.style && STYLES[input.style]) {
    const meta = STYLES[input.style];
    return {
      style: input.style,
      label: meta.label,
      detail: meta.detail,
      soundMood: meta.soundMood,
      soundQuery: meta.soundQuery,
      stillCount: stills.length,
      videoCount,
      signature: urls.join("|"),
      modelId: meta.modelId,
    };
  }
  if (!stills.length) return null;

  const scores = new Map<ImageStyleId, number>();
  const add = (style: ImageStyleId, amount: number) => {
    scores.set(style, (scores.get(style) ?? 0) + amount);
  };

  const blob = blobOf(stills, input.title, input.category);
  for (const row of KEYWORDS) {
    if (row.words.some((word) => blob.includes(word))) add(row.style, 3);
  }

  const category = input.category?.trim().toLowerCase() ?? "";
  const fromCategory = CATEGORY_STYLE[category];
  if (fromCategory) add(fromCategory, 2);

  const ratio = input.ratio;
  if (ratio && Number.isFinite(ratio)) {
    if (ratio < 0.82) add("mode", 2);
    else if (ratio > 1.25) add("lifestyle", 2);
    else add("neutre", 1);
  }

  let best: ImageStyleId = "neutre";
  let bestScore = 0;
  for (const [style, score] of scores) {
    if (score > bestScore) {
      best = style;
      bestScore = score;
    }
  }

  const meta = STYLES[best];
  return {
    style: best,
    label: meta.label,
    detail: meta.detail,
    soundMood: meta.soundMood,
    soundQuery: meta.soundQuery,
    stillCount: stills.length,
    videoCount,
    signature: urls.join("|"),
    modelId: meta.modelId,
  };
}

export function rankSoundtrack(tracks: CatalogTrack[], mood: string) {
  const needles = mood
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2);
  let best: CatalogTrack | null = null;
  let bestScore = 0;
  for (const track of tracks) {
    const blob =
      `${track.mood ?? ""} ${track.title} ${track.artist}`.toLowerCase();
    const score = needles.reduce(
      (total, word) => total + (blob.includes(word) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      best = track;
      bestScore = score;
    }
  }
  return best ?? tracks[0] ?? null;
}

const PRODUCT_REEL: Record<string, readonly SlideMotion[]> = {
  defile: ["zoom-in", "pan-left", "pan-right", "zoom-out"],
  "gros-plan": ["zoom-in", "pan-up", "zoom-in", "zoom-out"],
  vitrine: ["zoom-in", "zoom-out", "pan-left", "pan-up"],
  ambiance: ["zoom-out", "pan-up", "zoom-in", "pan-right"],
  story: ["pan-up", "zoom-in", "pan-up", "zoom-out"],
};

/** Toutes les photos d’un produit s’enchaînent en un seul montage. */
export function motionsForModel(urls: string[], model: VideoStyleModel) {
  const list = urls.slice(0, 12);
  const stillCount = list.filter(isStill).length;
  const reel = PRODUCT_REEL[model.id] ?? model.motions;
  let still = 0;
  return list.map((url) => {
    if (!isStill(url)) return "";
    const motion =
      stillCount === 1
        ? model.motions[0]!
        : still === 0
          ? "zoom-in"
          : still === stillCount - 1
            ? "zoom-out"
            : reel[still % reel.length]!;
    still += 1;
    return encodeSlideMotion(motion);
  });
}
