import { Image, Platform } from "react-native";

/** Ratio largeur/hauteur du mur d’accueil (plein écran type Stories / Reels). */
export const PRODUCT_WALL_RATIO = 9 / 16;

/** Canvas serveur / affichage : 1080×1920. */
export const PRODUCT_WALL_WIDTH = 1080;
export const PRODUCT_WALL_HEIGHT = 1920;

/** Fond letterbox (évite le blanc « trou » sur le mur sombre). */
export const PRODUCT_WALL_BG = "#0E0E14";

/**
 * Une image plus large que le mur (ex. 4:5, 1:1, paysage)
 * est coupée gauche/droite avec `contentFit: "cover"`.
 */
export function wallNeedsContain(
  imageWidth: number,
  imageHeight: number,
  wallRatio = PRODUCT_WALL_RATIO,
) {
  if (imageWidth <= 0 || imageHeight <= 0) return false;
  return imageWidth / imageHeight > wallRatio * 1.02;
}

export function fitInsideWall(
  width: number,
  height: number,
  maxW = PRODUCT_WALL_WIDTH,
  maxH = PRODUCT_WALL_HEIGHT,
) {
  const scale = Math.min(maxW / Math.max(1, width), maxH / Math.max(1, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
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

async function letterboxOnWeb(uri: string): Promise<string> {
  const photo = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Chargement image impossible"));
    img.src = uri;
  });

  const canvas = document.createElement("canvas");
  canvas.width = PRODUCT_WALL_WIDTH;
  canvas.height = PRODUCT_WALL_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");

  ctx.fillStyle = PRODUCT_WALL_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const scale = Math.min(
    canvas.width / photo.width,
    canvas.height / photo.height,
  );
  const drawnW = photo.width * scale;
  const drawnH = photo.height * scale;
  ctx.drawImage(
    photo,
    (canvas.width - drawnW) / 2,
    (canvas.height - drawnH) / 2,
    drawnW,
    drawnH,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (next) => (next ? resolve(next) : reject(new Error("Export JPEG impossible"))),
      "image/jpeg",
      0.82,
    );
  });
  return URL.createObjectURL(blob);
}

/**
 * Normalise une photo produit pour le mur 9:16 :
 * produit entier centré, bandes #0E0E14 — jamais de coupe G/D.
 * Web : canvas letterbox. Native : resize + capture letterbox si dispo.
 */
export async function normalizeProductWallStill(uri: string): Promise<string> {
  try {
    const size = await probeSize(uri);
    const needsLetterbox = wallNeedsContain(size.width, size.height);
    const needsDownscale =
      size.width > PRODUCT_WALL_WIDTH || size.height > PRODUCT_WALL_HEIGHT;

    if (Platform.OS === "web") {
      if (needsLetterbox || needsDownscale) {
        return await letterboxOnWeb(uri);
      }
      return uri;
    }

    const ImageManipulator = await import("expo-image-manipulator");
    const fitted = fitInsideWall(size.width, size.height);

    let workingUri = uri;
    if (needsDownscale) {
      const resized = await ImageManipulator.manipulateAsync(
        uri,
        [
          fitted.width / fitted.height >= 1
            ? { resize: { width: fitted.width } }
            : { resize: { height: fitted.height } },
        ],
        {
          compress: 0.86,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );
      workingUri = resized.uri || uri;
    }

    if (needsLetterbox) {
      try {
        const { captureProductWallLetterbox } = await import(
          "@/components/media/ProductWallCaptureHost"
        );
        return await captureProductWallLetterbox(workingUri);
      } catch {
        // Affichage `contain` côté mur couvre le fallback.
        return workingUri;
      }
    }

    if (!needsDownscale) {
      const light = await ImageManipulator.manipulateAsync(uri, [], {
        compress: 0.82,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      return light.uri || uri;
    }

    return workingUri;
  } catch {
    return uri;
  }
}
