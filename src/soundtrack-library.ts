import { api } from "@/src/api";
import { kvGet, kvSet, snapshotGet, snapshotSet } from "@/src/offline/db";
import {
    archivePreviewUrl,
    MONTAGE_MAX_MS,
    type LocalSoundtrackClip,
    type OnlineTrackHit,
} from "@/src/soundtrack";
import { Platform } from "react-native";

const POPULAR_KEY = "soundtracks.popular";
const FAVORITES_KEY = "soundtracks.favorites";
const RECENTS_KEY = "soundtracks.recents";
const POPULAR_AT = "soundtracks.popularAt";
const STALE_MS = 6 * 60 * 60 * 1000;
const CAP = 24;

export type LibrarySound = {
  key: string;
  title: string;
  artist: string;
  uri: string;
  durationMs: number;
  hookMs: number;
  soundtrackId?: string;
  remote?: { identifier: string; file: string };
  uses?: number;
  savedAt: number;
};

function readList(key: string) {
  const rows = snapshotGet<LibrarySound[]>(key);
  const parsed = Array.isArray(rows) ? rows : readWeb(key);
  return parsed.filter((row) => row?.key && row.uri && row.title);
}

function readWeb(key: string): LibrarySound[] {
  if (Platform.OS !== "web" || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as LibrarySound[]) : [];
    if (!Array.isArray(parsed) || !parsed.length) return [];
    snapshotSet(key, parsed);
    return parsed;
  } catch {
    return [];
  }
}

function writeList(key: string, rows: LibrarySound[]) {
  snapshotSet(key, rows);
  if (Platform.OS !== "web" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    /* quota */
  }
}

function popularStamp() {
  const saved = Number(kvGet(POPULAR_AT) ?? 0);
  if (saved) return saved;
  if (Platform.OS !== "web" || typeof localStorage === "undefined") return 0;
  const web = Number(localStorage.getItem(POPULAR_AT) ?? 0);
  if (web) kvSet(POPULAR_AT, String(web));
  return web;
}

export function readPopular() {
  return readList(POPULAR_KEY);
}

export function readFavorites() {
  return readList(FAVORITES_KEY);
}

export function readRecents() {
  return readList(RECENTS_KEY);
}

export function toggleFavorite(sound: LibrarySound) {
  const current = readFavorites();
  const next = current.some((item) => item.key === sound.key)
    ? current.filter((item) => item.key !== sound.key)
    : [{ ...sound, savedAt: Date.now() }, ...current].slice(0, CAP);
  writeList(FAVORITES_KEY, next);
  return next;
}

export function pushRecent(sound: LibrarySound) {
  const next = [
    { ...sound, savedAt: Date.now() },
    ...readRecents().filter((item) => item.key !== sound.key),
  ].slice(0, CAP);
  writeList(RECENTS_KEY, next);
  return next;
}

export function libraryFromHit(hit: OnlineTrackHit): LibrarySound {
  return {
    key: `archive:${hit.identifier}:${hit.file}`,
    title: hit.title,
    artist: hit.artist,
    uri: hit.previewUrl || archivePreviewUrl(hit.identifier, hit.file),
    durationMs: MONTAGE_MAX_MS,
    hookMs: hit.hookMs ?? 0,
    remote: { identifier: hit.identifier, file: hit.file },
    savedAt: Date.now(),
  };
}

export function libraryFromClip(clip: LocalSoundtrackClip): LibrarySound {
  if (clip.remote) {
    return libraryFromHit({
      identifier: clip.remote.identifier,
      title: clip.title,
      artist: clip.artist || "Import",
      file: clip.remote.file,
      previewUrl: clip.uri,
      hookMs: clip.hookMs,
    });
  }
  return {
    key: `file:${clip.uri}`,
    title: clip.title,
    artist: clip.artist || "Import",
    uri: clip.uri,
    durationMs: clip.durationMs,
    hookMs: clip.hookMs ?? 0,
    savedAt: Date.now(),
  };
}

let inflight: Promise<void> | null = null;

/** Une lecture réseau, puis le menu Populaire sert le cache SQLite. */
export function refreshPopularSounds(force = false) {
  const at = popularStamp();
  if (!force && at && Date.now() - at < STALE_MS) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    const data = await api<{
      tracks?: {
        id: string;
        title: string;
        artist: string;
        durationMs: number;
        audioUrl: string;
        uses?: number;
      }[];
    }>("/api/soundtracks/popular");
    const tracks = (data.tracks ?? [])
      .filter((row) => row.id && row.audioUrl)
      .map(
        (row): LibrarySound => ({
          key: `track:${row.id}`,
          title: row.title,
          artist: row.artist,
          uri: row.audioUrl,
          durationMs: row.durationMs || MONTAGE_MAX_MS,
          hookMs: 0,
          soundtrackId: row.id,
          uses: row.uses ?? 0,
          savedAt: Date.now(),
        }),
      );
    writeList(POPULAR_KEY, tracks);
    kvSet(POPULAR_AT, String(Date.now()));
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(POPULAR_AT, String(Date.now()));
      } catch {
        /* quota */
      }
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
