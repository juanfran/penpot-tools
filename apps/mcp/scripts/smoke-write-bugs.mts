/**
 * Verifies the three converter bug fixes:
 *   1. letter-spacing stored without "px" suffix (no more "-6pxpx" round-trip).
 *   2. transform: rotate(<deg>) is honoured — rotation field set, x/y/w/h are
 *      the unrotated rect.
 *   3. A text element with background-color carries that as a shape-level fill
 *      (chip / pill pattern works without wrapping).
 *
 *   pnpm exec tsx scripts/smoke-write-bugs.mts
 */
import { htmlToChanges } from '@penpot-tools/html-to-penpot';
import type { Uuid } from '@penpot-tools/converter/types';

const html = `
<div style="position:relative; width:300px; height:160px; background:#F5F1EA;">
  <div data-name="Letter spacing probe"
       style="font-size:11px; letter-spacing:-6px; color:#1A1A1A;">
    LS
  </div>

  <div data-name="Rotated chip"
       style="position:absolute; left:40px; top:60px;
              transform:rotate(-4deg);
              padding:6px 14px; background:#1A1A1A;
              color:#FFFFFF; font-size:12px;
              letter-spacing:2px;">
    OCEAN VIEW
  </div>
</div>`.trim();

const pageId = '00000000-0000-0000-0000-000000000001' as Uuid;
const bundle = await htmlToChanges(html, {
  pageId,
  rootName: 'Bug fixes smoke',
  rootPosition: { x: 0, y: 0 },
});

const shapesByName = new Map<string, any>();
for (const change of bundle.changes) {
  if (change.type === 'add-obj' && change.obj?.name) {
    shapesByName.set(change.obj.name, change.obj);
  }
}

let pass = true;
const fail = (msg: string) => {
  pass = false;
  console.error('FAIL: ' + msg);
};

// 1. Letter spacing.
const lsProbe = shapesByName.get('Letter spacing probe');
if (!lsProbe) fail('Letter spacing probe shape missing');
else {
  const leaf = lsProbe.content?.children?.[0]?.children?.[0]?.children?.[0];
  if (!leaf) fail('Letter spacing probe has no leaf');
  else if (leaf.letterSpacing !== '-6')
    fail(`letterSpacing = ${JSON.stringify(leaf.letterSpacing)}, expected "-6"`);
  else console.error('PASS: letterSpacing stored as "-6" (no px suffix)');
}

// 2. Rotation.
const chip = shapesByName.get('Rotated chip');
if (!chip) fail('Rotated chip shape missing');
else {
  if (Math.abs((chip.rotation ?? 0) - 4) > 0.1)
    fail(`rotation = ${chip.rotation}, expected ~4`);
  else console.error('PASS: rotation = 4° (Penpot convention)');

  // 3. Text-shape background fill.
  const fill = chip.fills?.[0];
  if (!fill || fill.fillColor?.toUpperCase() !== '#1A1A1A')
    fail(`chip.fills = ${JSON.stringify(chip.fills)}, expected [#1A1A1A]`);
  else console.error('PASS: chip background lands on text shape fills');
}

if (bundle.warnings.length) {
  console.error('\nWarnings emitted:');
  for (const w of bundle.warnings) console.error('  - ' + w);
}

process.exit(pass ? 0 : 1);
