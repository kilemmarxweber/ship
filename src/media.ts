import { isVideoUrl, mediaUrl } from "@/src/api";

export function mediaList(images: string[] | null | undefined) {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const raw of images ?? []) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const url = mediaUrl(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

export function coverOf(images: string[] | null | undefined) {
  const list = images ?? [];
  return mediaUrl(list.find((url) => !isVideoUrl(url)) ?? list[0]);
}

export function productHasAudio(product: {
  images?: string[] | null;
  soundtrack?: { audioUrl?: string | null } | null;
}) {
  const images = product.images ?? [];
  return (
    Boolean(product.soundtrack?.audioUrl) ||
    images.some((url) => typeof url === "string" && isVideoUrl(mediaUrl(url) ?? url))
  );
}
