/** Web fallback: in-memory only (expo-sqlite wasm is unavailable in this Metro setup). */

const SCHEMA = 1;
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

const memKv = new Map<string, string>();
const memSnap = new Map<string, string>();
const memOutbox: OutboxRow[] = [];

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

export function wipeUserCache() {
  memSnap.clear();
  memOutbox.length = 0;
}
