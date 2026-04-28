/**
 * Offline smoke test for the html-to-penpot pipeline.
 *
 * Runs measure → tree → changes against a static HTML fragment and prints the
 * resulting Penpot changes. Does NOT call update-file, so no token or network
 * is needed.
 *
 *   pnpm exec tsx scripts/smoke-write.mts
 */
import { htmlToChanges } from '@penpot-tools/html-to-penpot';
import type { Uuid } from '@penpot-tools/converter/types';

const html = `
<div style="display:block; width: 360px; padding: 24px; background:#0F172A; border-radius:12px;">
  <div style="background:#2E51C4; height: 56px; border-radius: 8px;"></div>
  <p style="color:#FFFFFF; font-size: 24px; font-weight:700; font-family: Inter; margin-top: 16px;">
    Hello from the MCP
  </p>
  <p style="color:#94A3B8; font-size: 14px; font-family: Inter; margin-top: 8px;">
    A small board produced by html-to-penpot
  </p>
</div>
`.trim();

const pageId = '00000000-0000-0000-0000-000000000001' as Uuid;

console.error('Measuring + building...');
const t0 = Date.now();
const bundle = await htmlToChanges(html, {
  pageId,
  rootName: 'Smoke board',
  rootPosition: { x: 100, y: 200 },
});
console.error(`Done in ${Date.now() - t0}ms`);

console.error(`\nRoot shape id: ${bundle.rootShapeId}`);
console.error(`Created ${bundle.createdShapeIds.length} shapes`);
console.error(`Total changes: ${bundle.changes.length}`);
if (bundle.warnings.length) {
  console.error('\nWarnings:');
  for (const w of bundle.warnings) console.error('  - ' + w);
}

console.error('\n--- First add-objects change ---');
console.error(JSON.stringify(bundle.changes[0], null, 2));

console.error('\n--- Last (reg-objects) change ---');
console.error(JSON.stringify(bundle.changes.at(-1), null, 2));

process.exit(0);
