/**
 * Integration test for the real-world authoring scenario the user shipped via
 * the MCP: a "property card" with editorial overlap, a flex specs strip, and
 * the chip-split avatar/CTA pattern. The original run produced a visible
 * defect (text wrapping inside a tight flex row) plus subtle data quality
 * issues (fractional rotation residue, font fallback metrics).
 *
 * This test pins the post-fix behaviour:
 *   1. Auto-loaded webfonts → no warning about unresolved Inter.
 *   2. Coordinates snapped to 0.01px → no float-jitter tails.
 *   3. Specs strip wide enough to hold "2,840 sq ft" on one line → no
 *      tight-flex wrap warning.
 *   4. Every overlap is partial → no occlusion warning.
 *   5. The CTA, FOR SALE stamp, price card, address pill, specs strip all
 *      land as expected shape types with the right names.
 *
 * `autoLoadFonts: false` keeps the test offline. The font-loader has its own
 * unit test with a mocked fetch.
 */
import { afterAll, describe, expect, it } from 'vitest';
import type { Shape, Uuid } from '@penpot-tools/converter/types';
import { htmlToChanges } from './index';

const PAGE_ID = '00000000-0000-0000-0000-000000000001' as Uuid;

afterAll(() => {
  // Headless cleanup is registered in measure/headless.ts via beforeExit.
});

const PROPERTY_CARD_HTML = `<div data-name="Property card" style="position:relative; width:560px; height:740px; background:#F2EDE4; border-radius:24px; box-shadow:0 30px 60px -20px rgba(20,20,20,0.28);">
  <div data-name="Hero photo" style="position:absolute; left:40px; top:60px; width:480px; height:340px; border-radius:18px; background:linear-gradient(150deg, #BFD3C1 0%, #7FA189 35%, #4A6B53 65%, #2C3E2D 100%);"></div>
  <div data-name="For sale stamp" style="position:absolute; left:18px; top:42px; transform:rotate(-7deg); padding:6px 14px; background:#1B1A18; color:#F2EDE4; font-size:11px; font-weight:700; letter-spacing:4px; border-radius:2px;">FOR SALE</div>
  <div data-name="Price card" style="position:absolute; left:24px; top:330px; width:204px; padding:18px 22px; background:#1B1A18; border-radius:14px; box-shadow:0 18px 30px -12px rgba(20,20,20,0.45); display:flex; flex-direction:column; gap:6px;">
    <div data-name="Price label" style="font-size:10px; font-weight:600; letter-spacing:3px; color:#A19F9A;">ASKING</div>
    <div data-name="Price value" style="font-size:32px; font-weight:700; color:#F2EDE4; line-height:1.1;">$1.245M</div>
  </div>
  <div data-name="Address pill" style="position:absolute; left:368px; top:96px; width:212px; padding:14px 20px; background:#F2EDE4; border:1px solid #1B1A18; border-radius:99px; display:flex; flex-direction:column; gap:2px;">
    <div data-name="Street" style="font-size:14px; font-weight:600; color:#1B1A18;">412 Maple Ridge Dr.</div>
    <div data-name="City" style="font-size:10px; font-weight:600; color:#6B6963; letter-spacing:2px;">PORTLAND, OR</div>
  </div>
  <div data-name="Specs strip" style="position:absolute; left:236px; top:370px; padding:10px 22px; background:#F2EDE4; border-radius:99px; box-shadow:0 14px 30px -10px rgba(20,20,20,0.30); display:flex; gap:22px; align-items:center;">
    <div data-name="Beds" style="font-size:13px; font-weight:600; color:#1B1A18;">4 bd</div>
    <div data-name="Baths" style="font-size:13px; font-weight:600; color:#1B1A18;">3 ba</div>
    <div data-name="Sqft" style="font-size:13px; font-weight:600; color:#1B1A18; white-space:nowrap;">2,840 sq ft</div>
  </div>
  <div data-name="Property title" style="position:absolute; left:48px; top:454px; width:340px; font-size:26px; font-weight:600; color:#1B1A18; line-height:1.2;">Cedar House on the Ridge</div>
  <div data-name="View listing CTA" style="position:absolute; right:32px; bottom:32px; padding:14px 24px; background:#1B1A18; color:#F2EDE4; border-radius:99px; font-size:12px; font-weight:600; letter-spacing:2px; display:flex; align-items:center; justify-content:center;">VIEW LISTING</div>
</div>`;

interface AddObj {
  type: string;
  obj: Shape;
}

function shapesFrom(changes: unknown[]): Shape[] {
  return (changes as AddObj[])
    .filter((c) => c.type === 'add-obj')
    .map((c) => c.obj);
}

describe('integration — property card', () => {
  it('produces a clean board with no warnings', async () => {
    const { warnings, changes, rootShapeId, rootShapeName } = await htmlToChanges(
      PROPERTY_CARD_HTML,
      { pageId: PAGE_ID, autoLoadFonts: false },
    );

    expect(warnings).toEqual([]);

    expect(rootShapeName).toBe('Property card');

    const shapes = shapesFrom(changes);
    const board = shapes.find((s) => s.id === rootShapeId)!;
    expect(board.type).toBe('frame');
    expect(board.name).toBe('Property card');

    // Every key element survives by name + type.
    const byName = new Map(shapes.map((s) => [s.name, s]));
    expect(byName.get('Hero photo')?.type).toBe('rect');
    expect(byName.get('For sale stamp')?.type).toBe('frame');
    expect(byName.get('For sale stamp text')?.type).toBe('text');
    expect(byName.get('Price card')?.type).toBe('frame');
    expect(byName.get('Address pill')?.type).toBe('frame');
    expect(byName.get('Specs strip')?.type).toBe('frame');
    expect(byName.get('Property title')?.type).toBe('text');
    expect(byName.get('View listing CTA')?.type).toBe('frame');
    expect(byName.get('View listing CTA text')?.type).toBe('text');
  }, 30_000);

  it('snaps fractional rotation residue on the rotated stamp', async () => {
    const { changes } = await htmlToChanges(PROPERTY_CARD_HTML, {
      pageId: PAGE_ID,
      autoLoadFonts: false,
    });
    const stamp = shapesFrom(changes).find((s) => s.name === 'For sale stamp')!;
    expect(stamp).toBeDefined();
    // The pre-fix value was 97.81249809265137 — now ≤ 2 decimals.
    const decimalsOf = (n: number) => {
      const s = String(n);
      const dot = s.indexOf('.');
      return dot < 0 ? 0 : s.length - dot - 1;
    };
    expect(stamp.x).toBeDefined();
    expect(stamp.y).toBeDefined();
    expect(decimalsOf(stamp.x!)).toBeLessThanOrEqual(2);
    expect(decimalsOf(stamp.y!)).toBeLessThanOrEqual(2);
    // Selrect should also be snapped.
    expect(decimalsOf(stamp.selrect.x)).toBeLessThanOrEqual(2);
    expect(decimalsOf(stamp.selrect.y)).toBeLessThanOrEqual(2);
    expect(decimalsOf(stamp.selrect.width)).toBeLessThanOrEqual(2);
    expect(decimalsOf(stamp.selrect.height)).toBeLessThanOrEqual(2);
    // Rotation snapped to integer degrees.
    expect(stamp.rotation).toBe(7);
  }, 30_000);

  it('does NOT warn for the specs strip when Sqft fits with white-space:nowrap', async () => {
    const { warnings } = await htmlToChanges(PROPERTY_CARD_HTML, {
      pageId: PAGE_ID,
      autoLoadFonts: false,
    });
    const wrapWarn = warnings.find((w) => w.includes('wrapped'));
    expect(wrapWarn).toBeUndefined();
  }, 30_000);

  it('warns when the same specs strip is left tight enough to wrap', async () => {
    // Negative control: shrink the strip and drop white-space:nowrap so
    // "2,840 sq ft" wraps inside the row. The detector must surface this.
    const tightHtml = `<div data-name="Card" style="position:relative; width:300px; height:80px;">
      <div data-name="Specs strip" style="position:absolute; left:0; top:0; padding:10px 14px; display:flex; gap:6px; align-items:center; width:120px; background:#fff;">
        <div data-name="Beds" style="font-size:13px; font-weight:600;">4 bd</div>
        <div data-name="Baths" style="font-size:13px; font-weight:600;">3 ba</div>
        <div data-name="Sqft" style="font-size:13px; font-weight:600;">2,840 sq ft</div>
      </div>
    </div>`;
    const { warnings } = await htmlToChanges(tightHtml, {
      pageId: PAGE_ID,
      autoLoadFonts: false,
    });
    const wrapWarn = warnings.find((w) => w.includes('wrapped'));
    expect(wrapWarn).toBeDefined();
    expect(wrapWarn).toContain('"Specs strip"');
  }, 30_000);

  it('all overlapping pieces remain visible (no full-occlusion warnings)', async () => {
    const { warnings } = await htmlToChanges(PROPERTY_CARD_HTML, {
      pageId: PAGE_ID,
      autoLoadFonts: false,
    });
    const occluded = warnings.find((w) => w.toLowerCase().includes('hidden'));
    expect(occluded).toBeUndefined();
  }, 30_000);
});
