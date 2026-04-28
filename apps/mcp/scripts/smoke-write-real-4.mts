/**
 * Phase 4 smoke — creates a small board, then surgically modifies one of its
 * children via modify_shape's underlying mod-obj path. Verifies that the
 * surgical mod-obj wire format works end-to-end on a real Penpot file.
 *
 * Each modify operation calls update-file directly using the same set-op
 * builders the MCP tool uses (we exercise the helpers, not the registered
 * MCP tool itself, since the smoke runs outside the MCP transport).
 *
 *   PENPOT_TOKEN=... PENPOT_FILE_ID=... PENPOT_PAGE_ID=... \
 *     pnpm exec tsx scripts/smoke-write-real-4.mts
 */
import { htmlToChanges } from '@penpot-tools/html-to-penpot';
import type { FileChange, Uuid } from '@penpot-tools/converter/types';
import {
  getFileMeta,
  PenpotConflictError,
  updateFile,
} from '../src/penpot-api.ts';

const token = process.env['PENPOT_TOKEN'];
const fileId = process.env['PENPOT_FILE_ID'];
const pageId = process.env['PENPOT_PAGE_ID'];
if (!token || !fileId || !pageId) {
  console.error('Missing PENPOT_TOKEN / PENPOT_FILE_ID / PENPOT_PAGE_ID');
  process.exit(1);
}

const html = `
<div style="width: 320px; padding: 20px; background:#1E293B; border-radius: 8px;">
  <div data-name="hero" style="height: 80px; background:#475569; border-radius: 4px;"></div>
</div>
`.trim();

console.error('Step 1: build initial board...');
let meta = await getFileMeta(token, fileId);
const bundle = await htmlToChanges(html, {
  pageId: pageId as Uuid,
  rootName: 'MCP smoke (Phase 4)',
  rootPosition: { x: 100, y: 350 },
});
let result = await updateFile(token, fileId, meta.revn, meta.vern, bundle.changes);
console.error(`  initial board OK — revn ${result.revn}`);
console.error(`  shapes (board → outer → hero): ${bundle.createdShapeIds.join(', ')}`);

// The board itself is shapes[0]; the outer wrapper is shapes[1]; the inner
// "hero" rect is shapes[2] (board + outer div + inner div in document order).
const heroId = bundle.createdShapeIds[2];
if (!heroId) {
  console.error('No hero shape — abort');
  process.exit(1);
}

console.error(`Step 2: modify_shape on hero ${heroId} (color + radius + opacity + name)...`);
meta = await getFileMeta(token, fileId);
const change = {
  type: 'mod-obj',
  id: heroId,
  pageId,
  operations: [
    { type: 'set', attr: 'fills', val: [{ fillColor: '#22C55E', fillOpacity: 1 }], ignoreTouched: true },
    { type: 'set', attr: 'r1', val: 24, ignoreTouched: true },
    { type: 'set', attr: 'r2', val: 24, ignoreTouched: true },
    { type: 'set', attr: 'r3', val: 24, ignoreTouched: true },
    { type: 'set', attr: 'r4', val: 24, ignoreTouched: true },
    { type: 'set', attr: 'opacity', val: 0.85, ignoreTouched: true },
    { type: 'set', attr: 'name', val: 'hero (mod-obj)', ignoreTouched: true },
  ],
} as unknown as FileChange;

try {
  result = await updateFile(token, fileId, meta.revn, meta.vern, [change]);
  console.error(`  modify OK — new revn ${result.revn}`);
  console.error('  Refresh viewer; the inner rect should be green, more rounded, slightly transparent, renamed.');
} catch (err) {
  if (err instanceof PenpotConflictError) {
    console.error('CONFLICT:', err.message);
    process.exit(2);
  }
  throw err;
}
