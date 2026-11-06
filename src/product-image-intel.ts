import { Image } from "react-native";

export type ProductImageFit = "contain" | "cover" | "crop";

export type ProductImageCrop = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

export type ProductImageMeta = {
  url: string;
  originalUrl: string;
  width: number;
  height: number;
  ratio: number;
  fit: ProductImageFit;
  crop?: ProductImageCrop;
  isPrimary: boolean;
  warning?: string;
  tip?: string;
};

export type ProductImageCategoryHint =
  | "robes"
  | "hauts"
  | "chaussures"
  | "sacs"
  | "bijoux"
  | "divers";

const CATEGORY_RATIO: Record<
  ProductImageCategoryHint,
  { label: string; target: number; alt?: number }
> = {
  robes: { label: "2:3", target: 2 / 3 },
  hauts: { label: "4:5", target: 4 / 5 },
  chaussures: { label: "1:1 ou 4:5", target: 1, alt: 4 / 5 },
  sacs: { label: "1:1", target: 1 },
  bijoux: { label: "1:1", target: 1 },
  divers: { label: "4:5", target: 4 / 5 },
};

const MIN_SHORT_SIDE = 1200;

export function hintFromSellCategory(category: string): ProductImageCategoryHint {
  const key = category.trim().toLowerCase();
  if (/robe|jupe|pantalon|long/.test(key)) return "robes";
  if (/chemise|haut|t-?shirt|top|veste/.test(key)) return "hauts";
  if (/chaussure|basket|talon|botte/.test(key)) return "chaussures";
  if (/sac|accessoire/.test(key)) return "sacs";
  if (/bijou|montre|collier/.test(key)) return "bijoux";
  return "divers";
}

export function formatRatio(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return "—";
  if (Math.abs(ratio - 1) < 0.04) return "1:1";
  if (Math.abs(ratio - 4 / 5) < 0.05) return "4:5";
  if (Math.abs(ratio - 2 / 3) < 0.05) return "2:3";
  if (Math.abs(ratio - 3 / 4) < 0.05) return "3:4";
  if (Math.abs(ratio - 16 / 9) < 0.08) return "16:9";
  if (ratio > 1) return `${ratio.toFixed(2)}:1`;
  return `1:${(1 / ratio).toFixed(2)}`;
}

export function orientationOf(ratio: number): "portrait" | "landscape" | "square" {
  if (Math.abs(ratio - 1) < 0.04) return "square";
  return ratio > 1 ? "landscape" : "portrait";
}

function probeSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error ?? new Error("Taille image indisponible")),
    );
  });
}

export async function analyzeProductImage(
  uri: string,
  opts?: {
    categoryHint?: ProductImageCategoryHint;
    isPrimary?: boolean;
    originalUrl?: string;
  },
): Promise<ProductImageMeta> {
  const { width, height } = await probeSize(uri);
  const ratio = width / Math.max(1, height);
  const shortSide = Math.min(width, height);
  const hint = opts?.categoryHint ?? "divers";
  const reco = CATEGORY_RATIO[hint];

  let warning: string | undefined;
  let tip: string | undefined;

  if (shortSide > 0 && shortSide < MIN_SHORT_SIDE) {
    warning = `Résolution basse (${width}×${height}). Idéal ≥ ${MIN_SHORT_SIDE} px sur le petit côté.`;
  }
  if (ratio > 2.4 || ratio < 0.35) {
    warning = warning
      ? `${warning} Format très inhabituel.`
      : "Format très inhabituel — l’app affichera toute l’image (contain).";
  }

  const closest = Math.min(
    Math.abs(ratio - reco.target),
    reco.alt != null ? Math.abs(ratio - reco.alt) : Infinity,
  );
  if (closest > 0.12) {
    tip = `Conseil ${hint}: cadrage ~${reco.label} (ta photo ${formatRatio(ratio)}). Aucune obligation — contain par défaut.`;
  } else {
    tip = `Ratio ${formatRatio(ratio)} proche du conseil ${reco.label}.`;
  }

  return {
    url: uri,
    originalUrl: opts?.originalUrl ?? uri,
    width,
    height,
    ratio,
    fit: "contain",
    isPrimary: Boolean(opts?.isPrimary),
    warning,
    tip,
  };
}

export function sortPrimaryFirst(items: ProductImageMeta[]): ProductImageMeta[] {
  const primary = items.find((item) => item.isPrimary);
  if (!primary) {
    if (!items.length) return items;
    return items.map((item, index) => ({
      ...item,
      isPrimary: index === 0,
    }));
  }
  return [
    primary,
    ...items.filter((item) => item.url !== primary.url && item.originalUrl !== primary.originalUrl),
  ].map((item, index) => ({ ...item, isPrimary: index === 0 }));
}

export function urlsFromMeta(items: ProductImageMeta[]): string[] {
  return sortPrimaryFirst(items).map((item) => item.url);
}

export function recommendedRatioLabel(category: string): string {
  return CATEGORY_RATIO[hintFromSellCategory(category)].label;
}
