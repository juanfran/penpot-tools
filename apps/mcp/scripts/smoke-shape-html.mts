/**
 * Standalone smoke test for the get_shape_html conversion path.
 *
 * Loads the first cached page JSON in `packages/converter/cache`, picks any
 * non-root frame shape, and runs convertShape() the same way the MCP tool
 * does. No network calls — just verifies the converter actually produces
 * something for an arbitrary shape id.
 *
 *   pnpm exec tsx scripts/smoke-shape-html.mts
 */
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { convertShape } from '@penpot-tools/converter';
import type { ConverterContext } from '@penpot-tools/converter';
import { extractTokens } from '@penpot-tools/converter/tokens';
import type { Page } from '@penpot-tools/converter/types';

const cacheDir = resolve(import.meta.dirname, '../../../packages/converter/cache');
const entries = (await readdir(cacheDir)).filter((f) => f.endsWith('.json')).sort();
if (entries.length === 0) {
  console.error(
    `No cached page JSON in ${cacheDir}. Run \`pnpm penpot-to-html ... --cache\` first.`,
  );
  process.exit(1);
}

let chosenName: string | undefined;
let chosenPage: Page | undefined;
let chosenShapeId: string | undefined;

for (const name of entries) {
  const page = JSON.parse(await readFile(resolve(cacheDir, name), 'utf8')) as Page;
  const candidate = Object.values(page.objects).find(
    (s) => s.type === 'frame' && s.parentId !== s.id,
  );
  if (candidate) {
    chosenName = name;
    chosenPage = page;
    chosenShapeId = candidate.id;
    break;
  }
}

if (!chosenName || !chosenPage || !chosenShapeId) {
  console.error('No non-root frame shape found in any cached page.');
  process.exit(1);
}

console.error(`Using cache file: ${chosenName}`);
console.error(`Picked shape: ${chosenShapeId} (${chosenPage.objects[chosenShapeId]!.name})`);

const tokens = extractTokens(chosenPage.objects);
const ctx: ConverterContext = {
  resolveImageUrl: (id) => `https://design.penpot.app/assets/by-file-media-id/${id}`,
  tokens,
  format: false,
};

const shape = chosenPage.objects[chosenShapeId]!;
const { html } = await convertShape(shape, chosenPage.objects, ctx);

console.error(`Rendered html length: ${html.length}`);
console.log(html.slice(0, 200));
