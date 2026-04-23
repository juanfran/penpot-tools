/**
 * Inspect a Penpot shape and its parent chain from a cached page.
 * Optionally generates the HTML output for the shape.
 *
 * Usage:
 *   pnpm exec tsx scripts/inspect-shape.mts --file-id <uuid> --shape-id <uuid> [--page-id <uuid>] [--html]
 *
 * Flags:
 *   --file-id   UUID of the file (matches cache/<file-id>-<page-id>.json)
 *   --shape-id  UUID of the shape to inspect
 *   --page-id   UUID of the page (optional — picks the first matching cache file)
 *   --html      Also render and print the HTML output for this shape
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { convertShape } from '../src/converter/index.ts';
import { extractTokens } from '../src/converter/tokens.ts';
import type { Page, Shape } from '../src/penpot.types.ts';

const args = process.argv.slice(2);
const get = (flag: string): string | undefined => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
};
const has = (flag: string): boolean => args.includes(flag);

const fileId = get('--file-id');
const shapeId = get('--shape-id');
const pageId = get('--page-id');
const renderHtml = has('--html');

if (!fileId || !shapeId) {
  console.error(
    'Usage: pnpm exec tsx scripts/inspect-shape.mts --file-id <uuid> --shape-id <uuid> [--page-id <uuid>] [--html]',
  );
  process.exit(1);
}

function resolveCacheFile(fileId: string, pageId: string | undefined): string | undefined {
  if (pageId) {
    return join('cache', `${fileId}-${pageId}.json`);
  }
  // Auto-detect: match cache/<file-id>-<anything>.json, then fall back to cache/<file-id>.json
  let entries: string[];
  try {
    entries = readdirSync('cache');
  } catch {
    return undefined;
  }
  const match = entries.find((f) => f.startsWith(`${fileId}-`) && f.endsWith('.json'));
  if (match) return join('cache', match);
  if (entries.includes(`${fileId}.json`)) return join('cache', `${fileId}.json`);
  return undefined;
}

const cacheFile = resolveCacheFile(fileId, pageId);
let page: Page;
try {
  if (!cacheFile) throw new Error('not found');
  page = JSON.parse(readFileSync(cacheFile, 'utf-8')) as Page;
} catch {
  console.error(`Cache file not found for file-id=${fileId}${pageId ? ` page-id=${pageId}` : ''}`);
  console.error(`Run first: pnpm penpot-to-html --file-id ${fileId} --page-id <page-id> --cache`);
  process.exit(1);
}

const objects = page.objects;
const shape = objects[shapeId];
if (!shape) {
  console.error(`Shape "${shapeId}" not found in ${cacheFile}`);
  process.exit(1);
}

// Keys to omit — mostly geometry noise
const OMIT = new Set(['points', 'selrect', 'transform', 'transformInverse', 'pageId']);
const compact = (s: Shape) => Object.fromEntries(Object.entries(s).filter(([k]) => !OMIT.has(k)));

// Build parent chain (shape → … → root)
const chain: Shape[] = [];
let cur: Shape | undefined = shape;
while (cur) {
  chain.push(cur);
  const parentId = cur.parentId;
  if (!parentId || parentId === cur.id) break;
  cur = objects[parentId];
}

console.log('=== PARENT CHAIN (child → root) ===');
for (let i = 0; i < chain.length; i++) {
  const s = chain[i];
  const indent = '  '.repeat(i);
  const isTarget = i === 0;
  const label = isTarget ? '▶ TARGET' : `  parent[${i}]`;
  console.log(
    `${indent}${label}  id=${s.id}  name="${(s as unknown as { name?: string }).name ?? ''}"  type=${s.type}`,
  );
  const layout = (s as unknown as { layout?: string; layoutType?: string }).layout;
  const layoutType = (s as unknown as { layoutType?: string }).layoutType;
  if (layout || layoutType) {
    console.log(`${indent}         layout=${layout ?? layoutType}`);
  }
  const lDir = (s as unknown as { layoutFlexDir?: string }).layoutFlexDir;
  if (lDir) console.log(`${indent}         layoutFlexDir=${lDir}`);
  const hSizing = (s as unknown as { layoutItemHSizing?: string }).layoutItemHSizing;
  const vSizing = (s as unknown as { layoutItemVSizing?: string }).layoutItemVSizing;
  if (hSizing || vSizing) console.log(`${indent}         sizing h=${hSizing} v=${vSizing}`);
  const abs = (s as unknown as { layoutItemAbsolute?: boolean }).layoutItemAbsolute;
  if (abs) console.log(`${indent}         ⚠ layoutItemAbsolute=true`);
}

console.log('\n=== SHAPE DATA ===');
console.log(JSON.stringify(compact(shape), null, 2));

if (renderHtml) {
  const tokens = extractTokens(objects);
  const ctx = {
    resolveImageUrl: (id: string) => `https://design.penpot.app/assets/by-file-media-id/${id}`,
    tokens,
  };
  const { html } = await convertShape(shape, objects, ctx);
  console.log('\n=== RENDERED HTML ===');
  console.log(html);
}
