/**
 * Filesystem-backed store for `SemanticRule[]` per Penpot file. Mono-user,
 * per-machine: state lives at `~/.config/penpot-tools/semantics/<fileId>.json`
 * (override with `PENPOT_SEMANTICS_DIR`) so the viewer (writer) and the MCP
 * (reader) on the same machine see the same rules.
 *
 * Only the converter package's node-side code imports from this file — the
 * subpath export (`@penpot-tools/converter/semantics-store`) keeps the
 * `node:fs` calls out of any browser bundle that imports from the main entry.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { SEMANTIC_TAGS, type SemanticRule, type SemanticTag } from './shape-code';

interface FileSemantics {
  rules: SemanticRule[];
  updatedAt?: string;
}

function assertValidFileId(fileId: string): void {
  // Confine to UUID-shaped fileIds so a hostile caller can't escape the dir.
  if (!/^[0-9a-f-]{8,}$/i.test(fileId)) {
    throw new Error(`Invalid fileId: ${fileId}`);
  }
}

export function getSemanticsFilePath(fileId: string): string {
  assertValidFileId(fileId);
  return process.env['PENPOT_SEMANTICS_DIR']
    ? join(process.env['PENPOT_SEMANTICS_DIR'], `${fileId}.json`)
    : join(homedir(), '.config', 'penpot-tools', 'semantics', `${fileId}.json`);
}

const RULE_TYPES: ReadonlySet<SemanticRule['type']> = new Set([
  'shape-id',
  'name-equals',
  'name-contains',
]);
const TAG_SET: ReadonlySet<string> = new Set(SEMANTIC_TAGS);

/** Manual TS type guard — keeps the converter package zod-free. */
function isSemanticRule(v: unknown): v is SemanticRule {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r['id'] === 'string' &&
    r['id'].length > 0 &&
    typeof r['type'] === 'string' &&
    RULE_TYPES.has(r['type'] as SemanticRule['type']) &&
    typeof r['value'] === 'string' &&
    r['value'].length > 0 &&
    typeof r['tag'] === 'string' &&
    TAG_SET.has(r['tag']) &&
    typeof r['enabled'] === 'boolean'
  );
}

const cache = new Map<string, FileSemantics>();

export async function readSemanticsFromDisk(fileId: string): Promise<SemanticRule[]> {
  assertValidFileId(fileId);
  const cached = cache.get(fileId);
  if (cached) return cached.rules;
  try {
    const raw = await readFile(getSemanticsFilePath(fileId), 'utf8');
    const parsed = JSON.parse(raw) as { rules?: unknown; updatedAt?: string };
    const rules: SemanticRule[] = Array.isArray(parsed.rules)
      ? parsed.rules.filter(isSemanticRule)
      : [];
    const result: FileSemantics = { rules, updatedAt: parsed.updatedAt };
    cache.set(fileId, result);
    return result.rules;
  } catch {
    cache.set(fileId, { rules: [] });
    return [];
  }
}

export async function writeSemanticsToDisk(
  fileId: string,
  rules: SemanticRule[],
): Promise<void> {
  assertValidFileId(fileId);
  const next: FileSemantics = { rules, updatedAt: new Date().toISOString() };
  cache.set(fileId, next);
  const path = getSemanticsFilePath(fileId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(next, null, 2), 'utf8');
}

/** Test hook — clears the in-memory cache so a test can re-read from disk. */
export function _resetSemanticsCacheForTesting(): void {
  cache.clear();
}

export type { SemanticRule, SemanticTag };
