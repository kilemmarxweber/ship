export const SCROLL_AD_MAX_VIDEOS = 8;
export const SCROLL_AD_DEFAULT_VIDEO = "/renard.mp4";
export const SCROLL_AD_DEFAULT_DELAY = 120;
export const SCROLL_AD_IMAGE_SECONDS = 8;

export type ScrollAdClip = {
  url: string;
  enabled: boolean;
  priority: number;
};

export function clampScrollAdPriority(value: unknown, fallback = 1) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(99, Math.max(1, Math.round(n)));
}

export function clampScrollAdDelay(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return SCROLL_AD_DEFAULT_DELAY;
  return Math.min(3600, Math.max(0, Math.round(n)));
}

function isAllowedAdVideoUrl(url: string) {
  const trimmed = url.trim();
  if (trimmed.length < 2 || trimmed.length > 500) return false;
  if (trimmed.includes("://") && !/^https?:\/\//i.test(trimmed)) return false;
  if (trimmed.startsWith("//")) return false;
  if (trimmed.startsWith("/")) return true;
  return /^https?:\/\//i.test(trimmed);
}

export function parseScrollAdVideos(
  raw: unknown,
  fallbackDefault = true,
): ScrollAdClip[] {
  if (!Array.isArray(raw)) {
    return fallbackDefault
      ? [{ url: SCROLL_AD_DEFAULT_VIDEO, enabled: true, priority: 1 }]
      : [];
  }
  const clips: ScrollAdClip[] = [];
  for (const [index, item] of raw.entries()) {
    if (clips.length >= SCROLL_AD_MAX_VIDEOS) break;
    if (typeof item === "string") {
      const url = item.trim();
      if (!isAllowedAdVideoUrl(url)) continue;
      clips.push({ url, enabled: true, priority: index + 1 });
      continue;
    }
    if (!item || typeof item !== "object" || !("url" in item)) continue;
    const url = String((item as { url: unknown }).url).trim();
    if (!isAllowedAdVideoUrl(url)) continue;
    const rec = item as { enabled?: unknown; priority?: unknown };
    clips.push({
      url,
      enabled: rec.enabled !== false,
      priority: clampScrollAdPriority(rec.priority, clips.length + 1),
    });
  }
  return clips;
}

export function clipName(url: string) {
  const path = url.split("?")[0] ?? url;
  return path.split("/").pop() || url;
}

export function nextPriority(clips: ScrollAdClip[]) {
  const max = clips.reduce((acc, clip) => Math.max(acc, clip.priority), 0);
  return clampScrollAdPriority(max + 1, clips.length + 1);
}

export const FLASH_DATE_PLACEHOLDER = "02-10-2026";
export const FLASH_TIME_PLACEHOLDER = "08:00";
export const FLASH_DEFAULT_TIME = "08:00";

const pad2 = (n: number) => String(n).padStart(2, "0");

export function toLocalDateParts(iso: string | null | undefined) {
  if (!iso) return { date: "", time: "" };
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return { date: "", time: "" };
  return {
    date: `${pad2(date.getDate())}-${pad2(date.getMonth() + 1)}-${date.getFullYear()}`,
    time: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
  };
}

export function maskFlashDate(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

export function maskFlashTime(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function fromLocalDateParts(date: string, time: string) {
  const day = date.trim();
  if (!day) return null;
  const clock = time.trim() || FLASH_DEFAULT_TIME;
  const slash = day.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  const iso = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let year: number;
  let month: number;
  let dayNum: number;
  if (slash) {
    dayNum = Number(slash[1]);
    month = Number(slash[2]);
    year = Number(slash[3]);
  } else if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    dayNum = Number(iso[3]);
  } else {
    throw new Error(`Date invalide — format ${FLASH_DATE_PLACEHOLDER}`);
  }
  const hm = clock.match(/^(\d{1,2}):(\d{2})$/);
  if (!hm) throw new Error(`Heure invalide — format ${FLASH_TIME_PLACEHOLDER}`);
  const hours = Number(hm[1]);
  const mins = Number(hm[2]);
  if (
    month < 1 ||
    month > 12 ||
    dayNum < 1 ||
    dayNum > 31 ||
    hours > 23 ||
    mins > 59
  ) {
    throw new Error(`Date invalide — format ${FLASH_DATE_PLACEHOLDER}`);
  }
  const local = new Date(year, month - 1, dayNum, hours, mins);
  if (
    !Number.isFinite(local.getTime()) ||
    local.getFullYear() !== year ||
    local.getMonth() !== month - 1 ||
    local.getDate() !== dayNum
  ) {
    throw new Error(`Date invalide — format ${FLASH_DATE_PLACEHOLDER}`);
  }
  return local.toISOString();
}
