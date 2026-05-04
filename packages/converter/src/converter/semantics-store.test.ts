import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  _resetSemanticsCacheForTesting,
  readSemanticsFromDisk,
  type SemanticRule,
  writeSemanticsToDisk,
} from './semantics-store';

const FILE_A = '11111111-1111-1111-1111-111111111111';
const FILE_B = '22222222-2222-2222-2222-222222222222';

function rule(over: Partial<SemanticRule> & { type: SemanticRule['type'] }): SemanticRule {
  return {
    id: over.id ?? `r-${Math.random().toString(36).slice(2, 8)}`,
    type: over.type,
    value: over.value ?? 'btn',
    tag: over.tag ?? 'button',
    enabled: over.enabled ?? true,
  };
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'penpot-semantics-test-'));
  process.env['PENPOT_SEMANTICS_DIR'] = dir;
  _resetSemanticsCacheForTesting();
});

afterEach(async () => {
  delete process.env['PENPOT_SEMANTICS_DIR'];
  await rm(dir, { recursive: true, force: true });
});

describe('semantics-store', () => {
  it('returns empty rules for a file with no JSON on disk', async () => {
    expect(await readSemanticsFromDisk(FILE_A)).toEqual([]);
  });

  it('persists rules to <fileId>.json under PENPOT_SEMANTICS_DIR', async () => {
    const rules = [rule({ type: 'shape-id', value: 'shape-1', tag: 'button' })];
    await writeSemanticsToDisk(FILE_A, rules);

    const raw = await readFile(join(dir, `${FILE_A}.json`), 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.rules).toEqual(rules);
    expect(typeof parsed.updatedAt).toBe('string');
  });

  it('round-trips rules across cache resets (writes survive a fresh read)', async () => {
    const rules = [
      rule({ type: 'name-contains', value: 'button', tag: 'button' }),
      rule({ type: 'name-equals', value: 'link', tag: 'a' }),
    ];
    await writeSemanticsToDisk(FILE_A, rules);

    _resetSemanticsCacheForTesting();
    expect(await readSemanticsFromDisk(FILE_A)).toEqual(rules);
  });

  it('serves the cached value on the second read without touching disk', async () => {
    const rules = [rule({ type: 'shape-id', value: 'x', tag: 'section' })];
    await writeSemanticsToDisk(FILE_A, rules);

    // Delete the file behind the cache; the next read should still hit memory.
    await rm(join(dir, `${FILE_A}.json`));
    expect(await readSemanticsFromDisk(FILE_A)).toEqual(rules);
  });

  it('drops malformed entries while keeping the rest', async () => {
    const validRule = rule({ type: 'shape-id', value: 'a', tag: 'button' });
    await writeFile(
      join(dir, `${FILE_A}.json`),
      JSON.stringify({
        rules: [
          validRule,
          { type: 'unknown-type', value: 'x', tag: 'div', enabled: true }, // bad type
          { type: 'shape-id', value: 'y', tag: 'not-a-tag', enabled: true }, // bad tag
          { type: 'shape-id', tag: 'button', enabled: true }, // missing value
        ],
      }),
    );

    expect(await readSemanticsFromDisk(FILE_A)).toEqual([validRule]);
  });

  it('returns empty rules when the file contains invalid JSON', async () => {
    await writeFile(join(dir, `${FILE_A}.json`), '{ this is not json');
    expect(await readSemanticsFromDisk(FILE_A)).toEqual([]);
  });

  it('keeps stores for different fileIds isolated', async () => {
    const rulesA = [rule({ type: 'shape-id', value: 'a', tag: 'button' })];
    const rulesB = [rule({ type: 'shape-id', value: 'b', tag: 'a' })];
    await writeSemanticsToDisk(FILE_A, rulesA);
    await writeSemanticsToDisk(FILE_B, rulesB);

    expect(await readSemanticsFromDisk(FILE_A)).toEqual(rulesA);
    expect(await readSemanticsFromDisk(FILE_B)).toEqual(rulesB);
  });

  it('rejects fileIds that look like path-traversal attempts', async () => {
    await expect(writeSemanticsToDisk('../escape', [])).rejects.toThrow(/Invalid fileId/);
    await expect(readSemanticsFromDisk('not/a/uuid')).rejects.toThrow(/Invalid fileId/);
  });
});
