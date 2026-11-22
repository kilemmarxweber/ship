export type ImageTone = {
  warm: number;
  bright: number;
  vivid: number;
};

/** Lit les couleurs réelles de la photo (navigateur) pour orienter le style musical. */
export function scanImageTone(uri: string): Promise<ImageTone | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = document.createElement("img");
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 24;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(image, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let warm = 0;
        let bright = 0;
        let vivid = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          bright += max / 255;
          vivid += max === 0 ? 0 : (max - min) / max;
          warm += r > b ? (r - b) / 255 : 0;
          count += 1;
        }
        if (!count) {
          resolve(null);
          return;
        }
        resolve({
          warm: warm / count,
          bright: bright / count,
          vivid: vivid / count,
        });
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = uri;
  });
}

/** Phrase ajoutée à la recherche selon les couleurs lues. */
export function tonePhrase(tone: ImageTone) {
  if (tone.bright < 0.32) return "cinematic";
  if (tone.vivid > 0.42 && tone.warm > 0.18) return "soul";
  if (tone.bright > 0.7 && tone.vivid < 0.28) return "chill";
  if (tone.warm > 0.22) return "groove";
  return "";
}
