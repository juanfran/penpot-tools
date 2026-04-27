/**
 * Standalone smoke test for the list_assets walker.
 *
 * Loads the first cached page JSON in `packages/converter/cache`, walks the
 * shapes the same way the `list_assets` tool does, and prints a summary. No
 * network calls — pairs the walker logic in isolation from MCP plumbing.
 *
 *   pnpm exec tsx scripts/smoke-assets.mts
 */
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Page } from '@penpot-random/converter/types';
import { collectPageAssets } from '../src/tools/assets.ts';

const cacheDir = resolve(import.meta.dirname, '../../../packages/converter/cache');
const entries = (await readdir(cacheDir)).filter((f) => f.endsWith('.json')).sort();
if (entries.length === 0) {
  console.error(
    `No cached page JSON in ${cacheDir}. Run \`pnpm penpot-to-html ... --cache\` first.`,
  );
  process.exit(1);
}

let chosenName = entries[0]!;
let chosenPage = JSON.parse(await readFile(resolve(cacheDir, chosenName), 'utf8')) as Page;
let chosenAssets = collectPageAssets(chosenPage);
for (const name of entries) {
  const page = JSON.parse(await readFile(resolve(cacheDir, name), 'utf8')) as Page;
  const assets = collectPageAssets(page);
  if (assets.length > 0) {
    chosenName = name;
    chosenPage = page;
    chosenAssets = assets;
    break;
  }
}
console.error(`Using cache file: ${chosenName}`);
const page = chosenPage;
const assets = chosenAssets;

console.error(`Found ${assets.length} unique image asset(s) on page "${page.name}".`);
for (const asset of assets) {
  console.log(
    JSON.stringify({
      id: asset.id,
      name: asset.name,
      mediaType: asset.mediaType,
      width: asset.width,
      height: asset.height,
      references: asset.references.length,
    }),
  );
}
