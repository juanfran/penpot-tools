import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DB_VERSION = 1;

let db: DatabaseSync | null = null;

export interface FileAccess {
  fileId: string;
  teamId?: string;
  lastAccessedAt: string;
}

export function getViewerDbPath(): string {
  return (
    process.env['PENPOT_TOOLS_VIEWER_DB'] ?? join(homedir(), '.config', 'penpot-tools', 'viewer.db')
  );
}

function getDb(): DatabaseSync {
  if (db) return db;

  const path = getViewerDbPath();
  mkdirSync(dirname(path), { recursive: true });
  db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  runMigrations(db);
  return db;
}

function runMigrations(database: DatabaseSync): void {
  const version = database.prepare('PRAGMA user_version').get() as { user_version: number };
  if (version.user_version >= DB_VERSION) return;

  database.exec('BEGIN');
  try {
    if (version.user_version < 1) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS file_accesses (
          file_id TEXT PRIMARY KEY NOT NULL,
          team_id TEXT,
          last_accessed_at TEXT NOT NULL
        );
      `);
    }

    database.exec(`PRAGMA user_version = ${DB_VERSION}`);
    database.exec('COMMIT');
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }
}

export function markFileAccessed(fileId: string, teamId?: string): FileAccess {
  const lastAccessedAt = new Date().toISOString();
  getDb()
    .prepare(
      `
      INSERT INTO file_accesses (file_id, team_id, last_accessed_at)
      VALUES (?, ?, ?)
      ON CONFLICT(file_id) DO UPDATE SET
        team_id = excluded.team_id,
        last_accessed_at = excluded.last_accessed_at
      `,
    )
    .run(fileId, teamId ?? null, lastAccessedAt);

  return { fileId, teamId, lastAccessedAt };
}

export function getFileAccesses(fileIds: string[]): Record<string, string> {
  if (fileIds.length === 0) return {};

  const placeholders = fileIds.map(() => '?').join(', ');
  const rows = getDb()
    .prepare(
      `
      SELECT file_id, last_accessed_at
      FROM file_accesses
      WHERE file_id IN (${placeholders})
      `,
    )
    .all(...fileIds) as Array<{ file_id: string; last_accessed_at: string }>;

  return Object.fromEntries(rows.map((row) => [row.file_id, row.last_accessed_at]));
}
