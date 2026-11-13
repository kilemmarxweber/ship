import { isVideoUrl, mediaUrl } from "@/src/api";
import { resolveCachedMedia } from "@/src/offline/media-cache";

/** Absolute remote URL, rewritten to local SQLite/file cache when available. */
export function playableMediaUrl(path: string | null | undefined) {
  const remote = mediaUrl(path);
  if (!remote) return null;
  if (remote.startsWith("file://") || remote.startsWith("content://")) {
    return remote;
  }
  return resolveCachedMedia(remote) ?? remote;
}

export function mediaList(images: string[] | null | undefined) {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const raw of images ?? []) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const url = playableMediaUrl(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

export function coverOf(images: string[] | null | undefined) {
  const list = images ?? [];
  const pick = list.find((url) => !isVideoUrl(url)) ?? list[0];
  return playableMediaUrl(pick);
}

export function productHasAudio(product: {
  images?: string[] | null;
  soundtrack?: { audioUrl?: string | null } | null;
}) {
  const images = product.images ?? [];
  return (
    Boolean(product.soundtrack?.audioUrl) ||
    images.some(
      (url) => typeof url === "string" && isVideoUrl(mediaUrl(url) ?? url),
    )
  );
}
