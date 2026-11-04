import { isVideoUrl, mediaUrl } from "@/src/api";

export function mediaList(images: string[]) {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const raw of images) {
    const url = mediaUrl(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

export function coverOf(images: string[]) {
  return mediaUrl(images.find((url) => !isVideoUrl(url)) ?? images[0]);
}

export function productHasAudio(product: {
  images: string[];
  soundtrack?: { audioUrl?: string | null } | null;
}) {
  return (
    Boolean(product.soundtrack?.audioUrl) ||
    product.images.some((url) => isVideoUrl(mediaUrl(url) ?? url))
  );
}
