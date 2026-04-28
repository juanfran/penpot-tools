/**
 * Phase 2 smoke — exercises flex, gradients, multiple shadows, strokes and
 * rounded corners on the user's real Penpot file.
 *
 *   PENPOT_TOKEN=... PENPOT_FILE_ID=... PENPOT_PAGE_ID=... \
 *     pnpm exec tsx scripts/smoke-write-real-2.mts
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
<div style="width: 480px; padding: 24px; background: #0F172A; border-radius: 16px;
            box-shadow: 0 12px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(148,163,184,0.2);">
  <div style="display: flex; flex-direction: row; align-items: center; gap: 16px; padding-bottom: 16px;">
    <div style="width: 56px; height: 56px; border-radius: 999px;
                background: linear-gradient(135deg, #6366F1 0%, #EC4899 100%);"></div>
    <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
      <p style="color: #F8FAFC; font-size: 18px; font-weight: 700; font-family: Inter;">Acme Inc.</p>
      <p style="color: #94A3B8; font-size: 13px; font-family: Inter;">Plan PRO · 12 miembros</p>
    </div>
  </div>
  <div style="display: flex; flex-direction: row; gap: 12px;">
    <div style="flex: 1; padding: 12px; background: #1E293B; border-radius: 10px;
                border: 1px solid #334155;">
      <p style="color: #94A3B8; font-size: 11px; font-family: Inter; font-weight: 500;">USUARIOS</p>
      <p style="color: #F8FAFC; font-size: 24px; font-weight: 700; font-family: Inter;">1,284</p>
    </div>
    <div style="flex: 1; padding: 12px; background: linear-gradient(180deg, #1E293B 0%, #0F172A 100%);
                border-radius: 10px;">
      <p style="color: #94A3B8; font-size: 11px; font-family: Inter; font-weight: 500;">INGRESOS</p>
      <p style="color: #4ADE80; font-size: 24px; font-weight: 700; font-family: Inter;">$48.2k</p>
    </div>
  </div>
</div>
`.trim();

console.error(`Reading file meta for ${fileId}...`);
const meta = await getFileMeta(token, fileId);
console.error(`Current revn=${meta.revn} vern=${meta.vern}`);

console.error('Building changes...');
const t0 = Date.now();
const bundle = await htmlToChanges(html, {
  pageId: pageId as Uuid,
  rootName: 'MCP smoke (Phase 2)',
  rootPosition: { x: 600, y: 100 },
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
