/**
 * Phase 3 smoke — creates a token set, then a board referencing the tokens
 * via `var(--name, fallback)`. Verifies that:
 *   1. `setTokensLib` accepts the DTCG payload via Transit JSON
 *   2. `htmlToChanges` extracts token references from inline styles
 *   3. The resulting shapes carry `appliedTokens` and Penpot accepts them
 *
 *   PENPOT_TOKEN=... PENPOT_FILE_ID=... PENPOT_PAGE_ID=... \
 *     pnpm exec tsx scripts/smoke-write-real-3.mts
 */
import { htmlToChanges } from '@penpot-tools/html-to-penpot';
import type { Uuid } from '@penpot-tools/converter/types';
import {
  type DtcgTokensLib,
  getFileMeta,
  PenpotConflictError,
  setTokensLib,
  updateFile,
} from '../src/penpot-api.ts';

const token = process.env['PENPOT_TOKEN'];
const fileId = process.env['PENPOT_FILE_ID'];
const pageId = process.env['PENPOT_PAGE_ID'];
if (!token || !fileId || !pageId) {
  console.error('Missing PENPOT_TOKEN / PENPOT_FILE_ID / PENPOT_PAGE_ID');
  process.exit(1);
}

const tokensLib: DtcgTokensLib = {
  theme: {
    'brand-primary': { $type: 'color', $value: '#2E51C4' },
    'brand-accent': { $type: 'color', $value: '#EC4899' },
    'fg-default': { $type: 'color', $value: '#0F172A' },
    'fg-muted': { $type: 'color', $value: '#94A3B8' },
    'fg-on-brand': { $type: 'color', $value: '#FFFFFF' },
  },
};

console.error('Step 1: setting tokens-lib...');
let meta = await getFileMeta(token, fileId);
console.error(`  current revn=${meta.revn} vern=${meta.vern}`);
const setRes = await setTokensLib(token, fileId, meta.revn, meta.vern, tokensLib);
console.error(`  setTokensLib OK — new revn=${setRes.revn}`);

const html = `
<div style="width: 360px; padding: 20px;
            background-color: var(--brand-primary, #2E51C4);
            border-radius: 12px;">
  <p style="color: var(--fg-on-brand, #FFFFFF); font-size: 22px; font-weight: 700;
            font-family: Inter; margin-bottom: 8px;">Tokens funcionando</p>
  <p style="color: var(--fg-muted, #94A3B8); font-size: 13px; font-family: Inter;">
    bg = brand-primary, color = fg-on-brand, secundario = fg-muted
  </p>
  <div style="margin-top: 16px; padding: 10px;
              background-color: var(--brand-accent, #EC4899);
              border-radius: 8px;">
    <p style="color: var(--fg-on-brand, #FFFFFF); font-size: 13px; font-family: Inter;">
      bg = brand-accent
    </p>
  </div>
</div>
`.trim();

console.error('Step 2: building htmlToChanges...');
const t0 = Date.now();
const bundle = await htmlToChanges(html, {
  pageId: pageId as Uuid,
  rootName: 'MCP smoke (Phase 3 — tokens)',
  rootPosition: { x: 1100, y: 100 },
});
console.error(
  `  built ${bundle.changes.length} changes (${bundle.createdShapeIds.length} shapes) in ${Date.now() - t0}ms`,
);
console.error(`  referenced tokens: ${bundle.referencedTokens.join(', ')}`);
if (bundle.warnings.length) {
  console.error('  warnings:');
  for (const w of bundle.warnings) console.error('    - ' + w);
}

console.error('Step 3: sending board changes...');
meta = await getFileMeta(token, fileId);
console.error(`  fresh meta revn=${meta.revn} vern=${meta.vern}`);
try {
  const t1 = Date.now();
  const result = await updateFile(token, fileId, meta.revn, meta.vern, bundle.changes);
  console.error(`  update-file OK in ${Date.now() - t1}ms — new revn: ${result.revn}`);
  console.error(`  Board id: ${bundle.rootShapeId}`);
  console.error('  Refresh the file in the viewer to see it.');
} catch (err) {
  if (err instanceof PenpotConflictError) {
    console.error('CONFLICT:', err.message);
    process.exit(2);
  }
  throw err;
}
