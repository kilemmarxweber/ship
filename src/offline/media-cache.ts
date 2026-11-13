import { Platform } from "react-native";

import {
    mediaCacheGet,
    mediaCacheList,
    mediaCacheRemove,
    mediaCacheUpsert,
    type MediaCacheKind,
    type MediaCacheRow,
} from "@/src/offline/db";

/** ~24 feed products × (video + audio) with headroom for discover. */
const MAX_ENTRIES = 72;
const CONCURRENCY = 2;

const inflight = new Map<string, Promise<string | null>>();
let queue: { remoteUrl: string; kind: MediaCacheKind }[] = [];
let workers = 0;

function hashKey(url: string) {
  let h = 5381;
  for (let i = 0; i < url.length; i += 1) {
    h = Math.imul(h, 33) ^ url.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

function pathExt(url: string) {
  const clean = url.split("?")[0]?.split("#")[0] ?? url;
  const match = /\.([a-z0-9]{2,5})$/i.exec(clean);
  return match?.[1]?.toLowerCase() ?? "";
}

export function detectMediaKind(
  url: string,
  mimeHint?: string | null,
): { kind: MediaCacheKind; ext: string; mimeType: string } {
  const mime = (mimeHint ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  const ext = pathExt(url);

  if (
    mime.startsWith("video/") ||
    /^(mp4|webm|mov|m4v|mkv|avi|3gp)$/i.test(ext)
  ) {
    const nextExt =
      ext ||
      (mime.includes("webm")
        ? "webm"
        : mime.includes("quicktime")
          ? "mov"
          : "mp4");
    return {
      kind: "video",
      ext: nextExt,
      mimeType: mime || `video/${nextExt === "mov" ? "quicktime" : nextExt}`,
    };
  }

  if (
    mime.startsWith("audio/") ||
    /^(mp3|m4a|aac|wav|ogg|opus|flac|caf)$/i.test(ext)
  ) {
    const nextExt =
      ext ||
      (mime.includes("mpeg")
        ? "mp3"
        : mime.includes("mp4") || mime.includes("m4a")
          ? "m4a"
          : mime.includes("wav")
            ? "wav"
            : "mp3");
    const mimeType =
      mime ||
      (nextExt === "mp3"
        ? "audio/mpeg"
        : nextExt === "m4a"
          ? "audio/mp4"
          : `audio/${nextExt}`);
    return { kind: "audio", ext: nextExt, mimeType };
  }

  const nextExt = ext || "jpg";
  return {
    kind: "image",
    ext: nextExt,
    mimeType: mime || `image/${nextExt === "jpg" ? "jpeg" : nextExt}`,
  };
}

function withFileScheme(uri: string) {
  if (!uri) return uri;
  return uri.startsWith("file://") ? uri : `file://${uri}`;
}

/** Sync lookup: returns local file:// when the media was already downloaded. */
export function resolveCachedMedia(remoteUrl: string | null | undefined) {
  if (!remoteUrl) return null;
  if (remoteUrl.startsWith("file://") || remoteUrl.startsWith("content://")) {
    return remoteUrl;
  }
  if (Platform.OS === "web") return null;
  const row = mediaCacheGet(remoteUrl);
  if (!row?.localUri) return null;
  // Keep recently used AV at the front of the LRU prune window.
  mediaCacheUpsert({ ...row, updatedAt: Date.now() });
  return withFileScheme(row.localUri);
}

async function ensureDir(dir: string) {
  const FileSystem = await import("expo-file-system/legacy");
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

async function pruneMediaCache() {
  const rows = mediaCacheList();
  if (rows.length <= MAX_ENTRIES) return;
  const FileSystem = await import("expo-file-system/legacy");
  const overflow = rows.slice(MAX_ENTRIES);
  for (const row of overflow) {
    mediaCacheRemove(row.remoteUrl);
    try {
      await FileSystem.deleteAsync(row.localUri, { idempotent: true });
    } catch {
      /* ignore */
    }
  }
}

async function downloadOne(
  remoteUrl: string,
  preferredKind?: MediaCacheKind,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const existing = mediaCacheGet(remoteUrl);
  if (existing?.localUri) {
    try {
      const FileSystem = await import("expo-file-system/legacy");
      const info = await FileSystem.getInfoAsync(existing.localUri);
      if (info.exists && (info.size ?? 0) > 64) {
        mediaCacheUpsert({ ...existing, updatedAt: Date.now() });
        return withFileScheme(existing.localUri);
      }
    } catch {
      mediaCacheRemove(remoteUrl);
    }
  }

  const detected = detectMediaKind(remoteUrl);
  const kind = preferredKind ?? detected.kind;

  try {
    const FileSystem = await import("expo-file-system/legacy");
    const root = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? ""}media-cache`;
    if (!root || root === "media-cache") return null;
    await ensureDir(root);

    const ext =
      detected.ext ||
      (kind === "audio" ? "mp3" : kind === "video" ? "mp4" : "bin");
    const dest = `${root}/${hashKey(remoteUrl)}.${ext}`;
    const result = await FileSystem.downloadAsync(remoteUrl, dest);
    if (result.status < 200 || result.status >= 300) return null;

    const info = await FileSystem.getInfoAsync(result.uri);
    if (!info.exists || (info.size ?? 0) < 64) {
      try {
        await FileSystem.deleteAsync(result.uri, { idempotent: true });
      } catch {
        /* ignore */
      }
      return null;
    }

    const headerMime =
      result.headers?.["Content-Type"] ||
      result.headers?.["content-type"] ||
      null;
    const finalMeta = detectMediaKind(remoteUrl, headerMime);
    const localUri = withFileScheme(result.uri);
    const row: MediaCacheRow = {
      remoteUrl,
      localUri,
      kind,
      mimeType: finalMeta.mimeType,
      ext: finalMeta.ext || ext,
      bytes: info.size ?? 0,
      updatedAt: Date.now(),
    };
    mediaCacheUpsert(row);
    await pruneMediaCache();
    return localUri;
  } catch {
    return null;
  }
}

function pumpQueue() {
  while (workers < CONCURRENCY && queue.length) {
    const next = queue.shift();
    if (!next) break;
    workers += 1;
    const job = downloadOne(next.remoteUrl, next.kind).finally(() => {
      inflight.delete(next.remoteUrl);
      workers -= 1;
      pumpQueue();
    });
    inflight.set(next.remoteUrl, job);
  }
}

/** Queue remote video/audio (and optional images) for offline playback. */
export function enqueueMediaCache(
  items: { url: string | null | undefined; kind?: MediaCacheKind }[],
) {
  if (Platform.OS === "web") return;
  for (const item of items) {
    const url = item.url?.trim();
    if (!url) continue;
    if (url.startsWith("file://") || url.startsWith("content://")) continue;
    if (inflight.has(url)) continue;
    if (queue.some((row) => row.remoteUrl === url)) continue;
    const kind = item.kind ?? detectMediaKind(url).kind;
    if (kind === "image") continue;
    queue.push({ remoteUrl: url, kind });
  }
  pumpQueue();
}

export async function cacheMediaNow(
  remoteUrl: string,
  kind?: MediaCacheKind,
): Promise<string | null> {
  if (!remoteUrl) return null;
  const existing = resolveCachedMedia(remoteUrl);
  if (existing) return existing;
  const pending = inflight.get(remoteUrl);
  if (pending) return pending;
  const job = downloadOne(remoteUrl, kind);
  inflight.set(remoteUrl, job);
  try {
    return await job;
  } finally {
    inflight.delete(remoteUrl);
  }
}

export async function clearMediaCacheFiles() {
  if (Platform.OS === "web") return;
  const rows = mediaCacheList();
  try {
    const FileSystem = await import("expo-file-system/legacy");
    for (const row of rows) {
      mediaCacheRemove(row.remoteUrl);
      try {
        await FileSystem.deleteAsync(row.localUri, { idempotent: true });
      } catch {
        /* ignore */
      }
    }
    const root = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? ""}media-cache`;
    if (root && root !== "media-cache") {
      await FileSystem.deleteAsync(root, { idempotent: true });
    }
  } catch {
    for (const row of rows) mediaCacheRemove(row.remoteUrl);
  }
}
