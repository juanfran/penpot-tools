/**
 * Filesystem I/O for semantic rules. Marked `.server.ts` so TanStack Start's
 * bundler strips it from the client bundle — node imports here would
 * otherwise leak through any client module that re-exports from this file.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  type FileSemantics,
  RuleSchema,
  type SemanticRule,
} from './semantics-types';

function assertValidFileId(fileId: string): void {
  // Confine to UUID-shaped fileIds so a hostile caller can't escape the dir.
  if (!/^[0-9a-f-]{8,}$/i.test(fileId)) {
    throw new Error(`Invalid fileId: ${fileId}`);
  }
}

function getFilePath(fileId: string): string {
  return process.env['PENPOT_SEMANTICS_DIR']
    ? join(process.env['PENPOT_SEMANTICS_DIR'], `${fileId}.json`)
    : join(homedir(), '.config', 'penpot-tools', 'semantics', `${fileId}.json`);
}

const cache = new Map<string, FileSemantics>();

export async function readSemanticsRaw(fileId: string): Promise<FileSemantics> {
  assertValidFileId(fileId);
  const cached = cache.get(fileId);
  if (cached) return cached;
  try {
    const raw = await readFile(getFilePath(fileId), 'utf8');
    const parsed = JSON.parse(raw) as FileSemantics;
    const result: FileSemantics = {
      rules: Array.isArray(parsed.rules)
        ? parsed.rules.filter((r): r is SemanticRule => RuleSchema.safeParse(r).success)
        : [],
      updatedAt: parsed.updatedAt,
    };
    cache.set(fileId, result);
    return result;
  } catch {
    const empty = { rules: [] as SemanticRule[] };
    cache.set(fileId, empty);
    return empty;
  }
}

export async function writeSemanticsRaw(
  fileId: string,
  next: FileSemantics,
): Promise<void> {
  assertValidFileId(fileId);
  cache.set(fileId, next);
  const path = getFilePath(fileId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(next, null, 2), 'utf8');
}

/** Server-only — used by `shape-code.ts` to resolve overrides without a round-trip. */
export async function readSemanticsFor(fileId: string): Promise<SemanticRule[]> {
  const { rules } = await readSemanticsRaw(fileId);
  return rules;
}

/** Test hook — clears the in-memory cache so a test can re-read from disk. */
export function _resetSemanticsCacheForTesting(): void {
  cache.clear();
}
