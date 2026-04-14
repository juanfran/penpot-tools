/**
 * Creates an integration test case from a cached Penpot page.
 *
 * Usage:
 *   pnpm exec tsx scripts/add-test-case.mts --name <test-name> --file-id <uuid> --board-id <uuid>
 *
 * Step 1 — fetch the page and save cache (skip if already cached):
 *   pnpm penpot-to-html --file-id <uuid> --page-id <uuid> --cache
 *
 * Step 2 — create the test case:
 *   pnpm exec tsx scripts/add-test-case.mts --name my-test --file-id <uuid> --board-id <uuid>
 *
 * The script:
 *   1. Reads cache/<file-id>.json
 *   2. Copies it to src/intengration/<name>.json
 *   3. Runs convertShape on the board-id shape
 *   4. Writes src/intengration/<name>.expected.html
 */

import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { convertShape } from '../src/converter/index.ts';
import { extractTokens } from '../src/converter/tokens.ts';
import type { Page } from '../src/penpot.types.ts';

const args = process.argv.slice(2);
const get = (flag: string): string | undefined => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
};

const name = get('--name');
const fileId = get('--file-id');
const boardId = get('--board-id') ?? get('--shape-id');

if (!name || !fileId || !boardId) {
  console.error(
    'Usage: pnpm exec tsx scripts/add-test-case.mts --name <name> --file-id <uuid> --board-id <uuid>',
  );
  process.exit(1);
}

const cacheFile = join('cache', `${fileId}.json`);
let page: Page;
try {
  page = JSON.parse(readFileSync(cacheFile, 'utf-8')) as Page;
} catch {
  console.error(`Cache file not found: ${cacheFile}`);
  console.error(`Run first: pnpm penpot-to-html --file-id ${fileId} --page-id <page-id> --cache`);
  process.exit(1);
}

const shape = page.objects[boardId];
if (!shape) {
  console.error(`Shape "${boardId}" not found in ${cacheFile}`);
  console.error('Tip: use --page-id when fetching to make sure you get the right page.');
  process.exit(1);
}

const destJson = join('src', 'intengration', `${name}.json`);
const destHtml = join('src', 'intengration', `${name}.expected.html`);

copyFileSync(cacheFile, destJson);
console.log(`Wrote ${destJson}`);

const tokens = extractTokens(page.objects);
const ctx = {
  resolveImageUrl: (id: string) => `https://assets.example.com/${id}`,
  tokens,
};

const { html } = await convertShape(shape, page.objects, ctx);
writeFileSync(destHtml, html.trim() + '\n', 'utf-8');
console.log(`Wrote ${destHtml}`);

console.log(`
Next: add this test case to src/intengration/integration.test.ts:

  it('${name}', async () => {
    const page = getPage('${name}');
    const shape = page.objects['${boardId}'];
    const { html } = await convertShape(shape, page.objects, ctx);
    expect(html.trim()).toBe(getExpected('${name}'));
  });
`);
