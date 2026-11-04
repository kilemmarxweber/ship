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

type SqliteHandle = {
  execSync: (sql: string) => void;
  getAllSync: <T>(sql: string, params?: unknown[]) => T[];
  runSync: (sql: string, params?: unknown[]) => void;
};

const memKv = new Map<string, string>();
const memSnap = new Map<string, string>();
const memOutbox: OutboxRow[] = [];

let sqlite: SqliteHandle | null = null;
let opened = false;

export async function openOfflineDb() {
  if (opened) return;
  opened = true;
  try {
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

export function outboxEnqueue(row: Omit<OutboxRow, "tries"> & { tries?: number }) {
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

export function wipeUserCache() {
  memSnap.clear();
  memOutbox.length = 0;
  try {
    sqlite?.execSync("DELETE FROM snapshot; DELETE FROM outbox;");
  } catch {
    /* memory only */
  }
}
