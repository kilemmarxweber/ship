/** Web fallback: in-memory only (expo-sqlite wasm is unavailable in this Metro setup). */

const SCHEMA = 3;
const SNAPSHOT_CAP = 400_000;

export type OutboxRow = {
  id: string;
  kind: string;
  path: string;
  method: string;
  body: string | null;
  createdAt: number;
  tries: number;
};

export type CisOutboxRow = {
  id: string;
  type: string;
  body: string;
  createdAt: number;
  tries: number;
};

export type MediaCacheKind = "image" | "video" | "audio";

export type MediaCacheRow = {
  remoteUrl: string;
  localUri: string;
  kind: MediaCacheKind;
  mimeType: string;
  ext: string;
  bytes: number;
  updatedAt: number;
};

const memKv = new Map<string, string>();
const memSnap = new Map<string, string>();
const memOutbox: OutboxRow[] = [];
const memCisOutbox: CisOutboxRow[] = [];
const memMedia = new Map<string, MediaCacheRow>();

let opened = false;

export async function openOfflineDb() {
  if (opened) return;
  opened = true;
  memKv.set("schema", String(SCHEMA));
}

export function kvGet(key: string) {
  return memKv.get(key) ?? null;
}

export function kvSet(key: string, value: string) {
  memKv.set(key, value);
}

export function snapshotGet<T>(key: string): T | null {
  const raw = memSnap.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function snapshotSet(key: string, value: unknown) {
  let raw = "";
  try {
    raw = JSON.stringify(value);
  } catch {
    return;
  }
  if (raw.length > SNAPSHOT_CAP) return;
  memSnap.set(key, raw);
}

export function snapshotDeletePrefix(prefix: string) {
  for (const key of [...memSnap.keys()]) {
    if (key.startsWith(prefix) || key === prefix) memSnap.delete(key);
  }
}

export function outboxEnqueue(
  row: Omit<OutboxRow, "tries"> & { tries?: number },
) {
  memOutbox.push({ tries: 0, ...row });
}

export function outboxList(): OutboxRow[] {
  return [...memOutbox];
}

export function outboxBump(id: string, tries: number) {
  const row = memOutbox.find((item) => item.id === id);
  if (row) row.tries = tries;
}

export function outboxRemove(id: string) {
  const index = memOutbox.findIndex((item) => item.id === id);
  if (index >= 0) memOutbox.splice(index, 1);
}

export function cisOutboxEnqueue(
  row: Omit<CisOutboxRow, "tries"> & { tries?: number },
) {
  memCisOutbox.push({ tries: 0, ...row });
}

export function cisOutboxList(): CisOutboxRow[] {
  return [...memCisOutbox];
}

export function cisOutboxBump(id: string, tries: number) {
  const row = memCisOutbox.find((item) => item.id === id);
  if (row) row.tries = tries;
}

export function cisOutboxRemove(id: string) {
  const index = memCisOutbox.findIndex((item) => item.id === id);
  if (index >= 0) memCisOutbox.splice(index, 1);
}

export function mediaCacheGet(remoteUrl: string): MediaCacheRow | null {
  return memMedia.get(remoteUrl) ?? null;
}

export function mediaCacheUpsert(row: MediaCacheRow) {
  memMedia.set(row.remoteUrl, row);
}

export function mediaCacheList(): MediaCacheRow[] {
  return [...memMedia.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function mediaCacheRemove(remoteUrl: string) {
  memMedia.delete(remoteUrl);
}

export function mediaCacheClear() {
  memMedia.clear();
}

export function wipeUserCache() {
  memSnap.clear();
  memOutbox.length = 0;
  memCisOutbox.length = 0;
  memMedia.clear();
}
