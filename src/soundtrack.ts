export const LOCAL_SOUNDTRACK_ID = "local";
export const MONTAGE_MAX_MS = 60_000;
export const SOUNDTRACK_SOURCE_MAX_MS = 10 * 60 * 1000;
export const AUDIO_INPUT_MAX_BYTES = 25 * 1024 * 1024;
export const VIDEO_INPUT_MAX_BYTES = 100 * 1024 * 1024;

export type CatalogTrack = {
  id: string;
  title: string;
  artist: string;
  mood?: string;
  durationMs: number;
  audioUrl: string;
};

export type OnlineTrackHit = {
  identifier: string;
  title: string;
  artist: string;
  file: string;
  previewUrl?: string;
  hookMs?: number;
};

export type LocalSoundtrackClip = {
  uri: string;
  title: string;
  fileName: string;
  mimeType: string;
  durationMs: number;
  artist?: string;
  remote?: { identifier: string; file: string };
  hookMs?: number;
};

export function viewerCountry(currency?: string | null) {
  if ((currency ?? "").toUpperCase() === "CDF") return "CD";
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const region = locale.split("-")[1]?.toUpperCase() ?? "";
    if (/^[A-Z]{2}$/.test(region)) return region;
  } catch {
    return "CD";
  }
  return "CD";
}

export function clampSoundtrackStartMs(
  startMs: number,
  durationMs: number,
  clipMs = MONTAGE_MAX_MS,
) {
  const windowMs = Math.min(clipMs, Math.max(0, durationMs));
  const maxStart = Math.max(0, durationMs - windowMs);
  return Math.min(maxStart, Math.max(0, Math.round(startMs)));
}

export function formatClipClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function isAudioLike(name: string, mime?: string | null) {
  const type = (mime ?? "").toLowerCase();
  if (type.startsWith("audio/")) return true;
  return /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|weba)$/i.test(name);
}

export function isVideoLike(name: string, mime?: string | null) {
  const type = (mime ?? "").toLowerCase();
  if (type.startsWith("video/")) return true;
  return /\.(mp4|mov|webm|m4v|mkv|avi|3gp)$/i.test(name);
}

export function archivePreviewUrl(identifier: string, file: string) {
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(file)}`;
}

export const SLIDE_MOTIONS = [
  "zoom-in",
  "zoom-out",
  "pan-left",
  "pan-right",
  "pan-up",
] as const;

export type SlideMotion = (typeof SLIDE_MOTIONS)[number];

const EXPLICIT_MOTION_PREFIX = "+";

export function isSlideMotion(value: string): value is SlideMotion {
  return (SLIDE_MOTIONS as readonly string[]).includes(value);
}

export function parseSlideMotion(raw?: string | null): SlideMotion | undefined {
  if (!raw) return undefined;
  const value = raw.startsWith(EXPLICIT_MOTION_PREFIX) ? raw.slice(1) : raw;
  return isSlideMotion(value) ? value : undefined;
}

export function encodeSlideMotion(motion: SlideMotion) {
  return `${EXPLICIT_MOTION_PREFIX}${motion}`;
}

export function slideshowSlotMs(
  count: number,
  clipMs = MONTAGE_MAX_MS,
  maxImages = 12,
) {
  const n = Math.max(1, Math.min(maxImages, count));
  return Math.max(800, Math.round(Math.max(1000, clipMs) / n));
}

export function slideshowWindow(
  index: number,
  count: number,
  clipMs = MONTAGE_MAX_MS,
  maxImages = 12,
) {
  const n = Math.max(1, Math.min(maxImages, count));
  const slot = slideshowSlotMs(n, clipMs);
  const start = Math.min(clipMs, index * slot);
  const end = index >= n - 1 ? clipMs : Math.min(clipMs, (index + 1) * slot);
  return { start, end, slot };
}

export function normalizeMotions(
  count: number,
  motions?: string[] | null,
  maxImages = 12,
): string[] {
  const n = Math.max(0, Math.min(maxImages, count));
  return Array.from({ length: n }, (_, i) => {
    const raw = motions?.[i];
    if (!raw) return "";
    if (raw.startsWith(EXPLICIT_MOTION_PREFIX) && parseSlideMotion(raw)) {
      return raw;
    }
    return isSlideMotion(raw) ? raw : "";
  });
}

export const MOTION_LABELS: Record<SlideMotion, string> = {
  "zoom-in": "Zoom avant",
  "zoom-out": "Zoom arrière",
  "pan-left": "Travelling gauche",
  "pan-right": "Travelling droit",
  "pan-up": "Travelling haut",
};

export function playableFileUri(uri: string) {
  if (
    /^https?:\/\//i.test(uri) ||
    uri.startsWith("file://") ||
    uri.startsWith("content://") ||
    uri.startsWith("blob:")
  ) {
    return uri;
  }
  return `file://${uri}`;
}
