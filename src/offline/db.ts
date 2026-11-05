const SCHEMA = 2;
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

type SqliteHandle = {
  execSync: (sql: string) => void;
  getAllSync: <T>(sql: string, params?: unknown[]) => T[];
  runSync: (sql: string, params?: unknown[]) => void;
};

const memKv = new Map<string, string>();
const memSnap = new Map<string, string>();
const memOutbox: OutboxRow[] = [];
const memMedia = new Map<string, MediaCacheRow>();

let sqlite: SqliteHandle | null = null;
let opened = false;

export async function openOfflineDb() {
  if (opened) return;
  opened = true;
  try {
    // Native-only path; web uses db.web.ts (no wasm).
    const SQLite = await import("expo-sqlite");
    const db = SQLite.openDatabaseSync("shipshop-offline.db");
    db.execSync(`
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS snapshot (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL,
        path TEXT NOT NULL,
        method TEXT NOT NULL,
        body TEXT,
        createdAt INTEGER NOT NULL,
        tries INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS media_cache (
        remoteUrl TEXT PRIMARY KEY NOT NULL,
        localUri TEXT NOT NULL,
        kind TEXT NOT NULL,
        mimeType TEXT NOT NULL,
        ext TEXT NOT NULL,
        bytes INTEGER NOT NULL DEFAULT 0,
        updatedAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS media_cache_updated
        ON media_cache (updatedAt DESC);
    `);
    sqlite = db as unknown as SqliteHandle;
    const row = sqlite.getAllSync<{ value: string }>(
      "SELECT value FROM kv WHERE key = ?",
      ["schema"],
    )[0];
    const version = Number(row?.value ?? 0);
    if (version && version !== SCHEMA) {
      sqlite.execSync("DELETE FROM snapshot; DELETE FROM outbox;");
    }
    sqlite.runSync("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)", [
      "schema",
      String(SCHEMA),
    ]);
  } catch {
    sqlite = null;
  }
}

export function kvGet(key: string) {
  try {
    if (sqlite) {
      const row = sqlite.getAllSync<{ value: string }>(
        "SELECT value FROM kv WHERE key = ?",
        [key],
      )[0];
      return row?.value ?? null;
    }
  } catch {
    return memKv.get(key) ?? null;
  }
  return memKv.get(key) ?? null;
}

export function kvSet(key: string, value: string) {
  memKv.set(key, value);
  try {
    sqlite?.runSync("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)", [
      key,
      value,
    ]);
  } catch {
    /* memory only */
  }
}

export function snapshotGet<T>(key: string): T | null {
  let raw: string | null = null;
  try {
    if (sqlite) {
      raw =
        sqlite.getAllSync<{ value: string }>(
          "SELECT value FROM snapshot WHERE key = ?",
          [key],
        )[0]?.value ?? null;
    } else {
      raw = memSnap.get(key) ?? null;
    }
  } catch {
    raw = memSnap.get(key) ?? null;
  }
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
  try {
    sqlite?.runSync(
      "INSERT OR REPLACE INTO snapshot (key, value, updatedAt) VALUES (?, ?, ?)",
      [key, raw, Date.now()],
    );
  } catch {
    /* memory only */
  }
}

export function snapshotDeletePrefix(prefix: string) {
  for (const key of [...memSnap.keys()]) {
    if (key.startsWith(prefix) || key === prefix) memSnap.delete(key);
  }
  try {
    sqlite?.runSync("DELETE FROM snapshot WHERE key LIKE ?", [`${prefix}%`]);
  } catch {
    /* memory only */
  }
}

export function outboxEnqueue(
  row: Omit<OutboxRow, "tries"> & { tries?: number },
) {
  const next: OutboxRow = { tries: 0, ...row };
  memOutbox.push(next);
  try {
    sqlite?.runSync(
      "INSERT OR REPLACE INTO outbox (id, kind, path, method, body, createdAt, tries) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        next.id,
        next.kind,
        next.path,
        next.method,
        next.body,
        next.createdAt,
        next.tries,
      ],
    );
  } catch {
    /* memory only */
  }
}

export function outboxList(): OutboxRow[] {
  try {
    if (sqlite) {
      return sqlite.getAllSync<OutboxRow>(
        "SELECT id, kind, path, method, body, createdAt, tries FROM outbox ORDER BY createdAt ASC",
      );
    }
  } catch {
    return [...memOutbox];
  }
  return [...memOutbox];
}

export function outboxBump(id: string, tries: number) {
  const row = memOutbox.find((item) => item.id === id);
  if (row) row.tries = tries;
  try {
    sqlite?.runSync("UPDATE outbox SET tries = ? WHERE id = ?", [tries, id]);
  } catch {
    /* memory only */
  }
}

export function outboxRemove(id: string) {
  const index = memOutbox.findIndex((item) => item.id === id);
  if (index >= 0) memOutbox.splice(index, 1);
  try {
    sqlite?.runSync("DELETE FROM outbox WHERE id = ?", [id]);
  } catch {
    /* memory only */
  }
}

export function mediaCacheGet(remoteUrl: string): MediaCacheRow | null {
  try {
    if (sqlite) {
      return (
        sqlite.getAllSync<MediaCacheRow>(
          "SELECT remoteUrl, localUri, kind, mimeType, ext, bytes, updatedAt FROM media_cache WHERE remoteUrl = ?",
          [remoteUrl],
        )[0] ?? null
      );
    }
  } catch {
    return memMedia.get(remoteUrl) ?? null;
  }
  return memMedia.get(remoteUrl) ?? null;
}

export function mediaCacheUpsert(row: MediaCacheRow) {
  memMedia.set(row.remoteUrl, row);
  try {
    sqlite?.runSync(
      "INSERT OR REPLACE INTO media_cache (remoteUrl, localUri, kind, mimeType, ext, bytes, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        row.remoteUrl,
        row.localUri,
        row.kind,
        row.mimeType,
        row.ext,
        row.bytes,
        row.updatedAt,
      ],
    );
  } catch {
    /* memory only */
  }
}

export function mediaCacheList(): MediaCacheRow[] {
  try {
    if (sqlite) {
      return sqlite.getAllSync<MediaCacheRow>(
        "SELECT remoteUrl, localUri, kind, mimeType, ext, bytes, updatedAt FROM media_cache ORDER BY updatedAt DESC",
      );
    }
  } catch {
    return [...memMedia.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return [...memMedia.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function mediaCacheRemove(remoteUrl: string) {
  memMedia.delete(remoteUrl);
  try {
    sqlite?.runSync("DELETE FROM media_cache WHERE remoteUrl = ?", [remoteUrl]);
  } catch {
    /* memory only */
  }
}

export function mediaCacheClear() {
  memMedia.clear();
  try {
    sqlite?.execSync("DELETE FROM media_cache;");
  } catch {
    /* memory only */
  }
}

export function wipeUserCache() {
  memSnap.clear();
  memOutbox.length = 0;
  try {
    sqlite?.execSync("DELETE FROM snapshot; DELETE FROM outbox;");
  } catch {
    /* memory only */
  }
  void import("@/src/offline/media-cache")
    .then((mod) => mod.clearMediaCacheFiles())
    .catch(() => {
      mediaCacheClear();
    });
}
