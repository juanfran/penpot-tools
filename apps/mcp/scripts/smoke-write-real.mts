/**
 * Real smoke test — creates a board in an actual Penpot file.
 *
 * Reads PENPOT_TOKEN, PENPOT_FILE_ID, PENPOT_PAGE_ID from the environment, runs
 * htmlToChanges on a small HTML fragment, and POSTs the changes to update-file.
 * Refresh the file in the Penpot viewer afterwards to see the result.
 *
 *   PENPOT_TOKEN=... PENPOT_FILE_ID=... PENPOT_PAGE_ID=... \
 *     pnpm exec tsx scripts/smoke-write-real.mts
 */
import { htmlToChanges } from '@penpot-tools/html-to-penpot';
import type { Uuid } from '@penpot-tools/converter/types';
import { getFileMeta, PenpotConflictError, updateFile } from '../src/penpot-api.ts';

const token = process.env['PENPOT_TOKEN'];
const fileId = process.env['PENPOT_FILE_ID'];
const pageId = process.env['PENPOT_PAGE_ID'];
if (!token || !fileId || !pageId) {
  console.error('Missing PENPOT_TOKEN / PENPOT_FILE_ID / PENPOT_PAGE_ID');
  process.exit(1);
}

const html = `
<div style="display:block; width: 360px; padding: 24px; background:#0F172A; border-radius:12px;">
  <div style="background:#2E51C4; height: 56px; border-radius: 8px;"></div>
  <p style="color:#FFFFFF; font-size: 24px; font-weight:700; font-family: Inter; margin-top: 16px;">
    Hello from html-to-penpot
  </p>
  <p style="color:#94A3B8; font-size: 14px; font-family: Inter; margin-top: 8px;">
    This board was created by the MCP write-mode pipeline (Phase 1).
  </p>
</div>
`.trim();

console.error(`Reading file meta for ${fileId}...`);
const meta = await getFileMeta(token, fileId);
console.error(`Current revn=${meta.revn} vern=${meta.vern}`);

console.error('Building changes...');
const t0 = Date.now();
const bundle = await htmlToChanges(html, {
  pageId: pageId as Uuid,
  rootName: 'MCP smoke (Phase 1)',
  rootPosition: { x: 100, y: 100 },
});
console.error(
  `Built ${bundle.changes.length} changes (${bundle.createdShapeIds.length} shapes) in ${Date.now() - t0}ms`,
);
if (bundle.warnings.length) {
  console.error('Warnings:');
  for (const w of bundle.warnings) console.error('  - ' + w);
}

console.error('Sending to update-file...');
try {
  const t1 = Date.now();
  const result = await updateFile(token, fileId, meta.revn, meta.vern, bundle.changes);
  console.error(`update-file OK in ${Date.now() - t1}ms — new revn: ${result.revn}`);
  console.error(`Board id: ${bundle.rootShapeId}`);
  console.error('Refresh the file in the viewer to see it.');
} catch (err) {
  if (err instanceof PenpotConflictError) {
    console.error('CONFLICT:', err.message);
    process.exit(2);
  }
  throw err;
}
