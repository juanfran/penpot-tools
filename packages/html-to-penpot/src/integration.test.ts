/**
 * End-to-end integration tests: drive the real headless renderer + buildTree
 * pipeline and assert on the resulting Penpot Shape[]. These tests are the
 * truth-table for what an LLM can rely on — if a CSS pattern works here, the
 * MCP tools should reproduce it on a real Penpot file.
 *
 * Slow (~1s per case for the headless boot), so we keep the suite focused on
 * regressions that are hard to catch with unit tests: positioning quirks
 * (right:/bottom:/transform), radius resolution, occlusion, the chip auto-
 * split, and the round-trip of overlapping editorial layouts.
 */
import { afterAll, describe, expect, it } from 'vitest';
import type { Uuid } from '@penpot-tools/converter/types';
import { htmlToChanges } from './index';

const PAGE_ID = '00000000-0000-0000-0000-000000000001' as Uuid;

afterAll(() => {
  // The headless driver lazily boots a singleton browser on first measureHtml
  // call. Vitest holds open handles unless we end the process — the driver
  // already registers a `beforeExit` cleanup, so nothing to do here. This
  // hook is kept as a marker for anyone adding test-side teardown later.
});

describe('integration — border-radius:50% on a square element', () => {
  it('resolves to a Penpot scalar radius equal to half the side', async () => {
    // The "save badge" pattern from the property card. Pre-fix this rendered
    // as a square because Chromium returns "50%" verbatim and parsePx
    // returned null.
    const html = `<div data-name="Card" style="width:200px; height:200px;">
      <div data-name="Badge" style="width:46px; height:46px; border-radius:50%; background:#000;"></div>
    </div>`;

    const { changes, warnings } = await htmlToChanges(html, { pageId: PAGE_ID });
    expect(warnings).toEqual([]);

    const badge = changes
      .filter((c) => (c as { type: string }).type === 'add-obj')
      .map((c) => (c as unknown as { obj: unknown }).obj as { name?: string; r1?: number; r2?: number; r3?: number; r4?: number })
      .find((s) => s.name === 'Badge');
    expect(badge).toBeDefined();
    expect(badge!.r1).toBe(23);
    expect(badge!.r2).toBe(23);
    expect(badge!.r3).toBe(23);
    expect(badge!.r4).toBe(23);
  }, 20_000);
});

describe('integration — root containing-block trap', () => {
  it('keeps right:/bottom: children inside the root when the root is position:relative', async () => {
    // First-attempt bug repro: "right:N" children escaped to body width
    // because the root div didn't establish a containing block.
    const html = `<div data-name="Card" style="position:relative; width:440px; height:640px; background:#F5F1EA;">
      <div data-name="Left" style="position:absolute; left:8px; top:50px; width:80px; height:30px; background:#000;"></div>
      <div data-name="Right" style="position:absolute; right:14px; top:50px; width:46px; height:46px; background:#0F0;"></div>
      <div data-name="CTA" style="position:absolute; right:24px; bottom:24px; width:160px; height:40px; background:#00F;"></div>
    </div>`;

    const { changes } = await htmlToChanges(html, { pageId: PAGE_ID });
    const shapes = changes
      .filter((c) => (c as { type: string }).type === 'add-obj')
      .map((c) => (c as unknown as { obj: unknown }).obj as { name?: string; x?: number; y?: number; width?: number; height?: number });
    const card = shapes.find((s) => s.name === 'Card');
    const left = shapes.find((s) => s.name === 'Left');
    const right = shapes.find((s) => s.name === 'Right');
    const cta = shapes.find((s) => s.name === 'CTA');

    expect(card).toBeDefined();
    expect(card!.width).toBe(440);
    expect(card!.height).toBe(640);

    // Left chip: x = 8 (its `left:8` resolved against the card).
    expect(left!.x).toBe(8);
    expect(left!.y).toBe(50);

    // Right chip: x = 440 - 14 - 46 = 380 (its `right:14` resolved against the card).
    expect(right!.x).toBe(380);
    expect(right!.y).toBe(50);

    // CTA: x = 440 - 24 - 160 = 256, y = 640 - 24 - 40 = 576.
    expect(cta!.x).toBe(256);
    expect(cta!.y).toBe(576);
  }, 20_000);
});

describe('integration — original failing card HTML repro', () => {
  it('still places right-anchored children inside the card', async () => {
    // The exact HTML I sent in the first failing attempt — kept here so the
    // regression is locked in.
    const html = `<div data-name="Property card" style="position:relative; width:440px; height:640px; background:#F5F1EA; border-radius:24px; box-shadow:0 30px 80px -20px rgba(40,30,20,0.25); padding:0;">
      <div data-name="Save badge" style="position:absolute; right:14px; top:50px; width:46px; height:46px; border-radius:50%; background:#F5F1EA; box-shadow:0 8px 22px -4px rgba(0,0,0,0.35);"></div>
      <div data-name="CTA button" style="position:absolute; right:24px; bottom:24px; width:160px; height:46px; background:#1A1A1A; border-radius:99px;"></div>
    </div>`;

    const { changes } = await htmlToChanges(html, { pageId: PAGE_ID });
    const shapes = changes
      .filter((c) => (c as { type: string }).type === 'add-obj')
      .map((c) => (c as unknown as { obj: unknown }).obj as { name?: string; x?: number; y?: number; width?: number });
    const card = shapes.find((s) => s.name === 'Property card');
    const save = shapes.find((s) => s.name === 'Save badge');
    const cta = shapes.find((s) => s.name === 'CTA button');

    expect(card!.width).toBe(440);
    expect(save!.x).toBe(380); // 440 - 14 - 46
    expect(cta!.x).toBe(256);  // 440 - 24 - 160
  }, 20_000);

  it('handles a card with mixed left:/right:/transform/text children (full property card)', async () => {
    // Closer to the real first-attempt: many children including chip patterns,
    // rotated stamps, text leaves, gradients, shadows. If `right:N` was
    // escaping in the real run, this should reproduce it.
    const html = `<div data-name="Card" style="position:relative; width:440px; height:640px; background:#F5F1EA;">
      <div data-name="Photo" style="position:absolute; left:24px; top:24px; width:392px; height:340px; border-radius:20px; background:linear-gradient(170deg, #C9D2C2 0%, #1F2A22 100%);"></div>
      <div data-name="Status chip" style="position:absolute; left:8px; top:56px; padding:9px 16px; background:#000; color:#FFF; font-size:11px; border-radius:0 4px 4px 0;">FOR SALE</div>
      <div data-name="Save badge" style="position:absolute; right:14px; top:50px; width:46px; height:46px; border-radius:50%; background:#F5F1EA;"></div>
      <div data-name="Stamp" style="position:absolute; right:32px; top:152px; transform:rotate(-7deg); padding:10px 16px; background:#FFF; border:2px solid #000; font-size:10px;">JUST LISTED</div>
      <div data-name="Stats card" style="position:absolute; right:22px; top:332px; width:236px; padding:16px 20px; background:#000; border-radius:14px;"></div>
      <div data-name="CTA" style="position:absolute; right:24px; bottom:24px; padding:14px 22px; background:#000; border-radius:99px; color:#FFF;">Schedule a tour</div>
    </div>`;

    const { changes } = await htmlToChanges(html, { pageId: PAGE_ID });
    const shapes = changes
      .filter((c) => (c as { type: string }).type === 'add-obj')
      .map((c) => (c as unknown as { obj: unknown }).obj as { name?: string; x?: number; width?: number });
    const card = shapes.find((s) => s.name === 'Card');
    const save = shapes.find((s) => s.name === 'Save badge');
    const stats = shapes.find((s) => s.name === 'Stats card');
    const cta = shapes.find((s) => s.name === 'CTA');

    // Card extends just beyond 440 only if `Status chip` at left:8 has its
    // shadow projecting left. The chip's left edge is x=8 inside the card,
    // so the card bbox starts at 0 and extends to 440.
    expect(card!.width).toBe(440);
    expect(save!.x).toBe(380);  // 440 - 14 - 46
    expect(stats!.x).toBe(182); // 440 - 22 - 236
    // CTA: right:24 from card. Card width = 440. CTA padding 14+22 = 36 plus
    // text width. Don't pin CTA x exactly — text widths shift with font.
    expect(cta!.x).toBeGreaterThan(200);
    expect(cta!.x).toBeLessThan(420);
  }, 20_000);
});

describe('integration — occlusion warning', () => {
  it('flags a small element fully covered by a later opaque sibling', async () => {
    // Real bug from the property-card session: a "01/24" photo counter inside
    // the photo, hidden by the cream price block that landed on top.
    const html = `<div data-name="Card" style="position:relative; width:400px; height:400px; background:#fff;">
      <div data-name="Counter" style="position:absolute; left:44px; top:200px; width:62px; height:27px; background:rgba(0,0,0,0.55); border-radius:99px;"></div>
      <div data-name="Block" style="position:absolute; left:0; top:180px; width:200px; height:80px; background:#F5F1EA;"></div>
    </div>`;

    const { warnings } = await htmlToChanges(html, { pageId: PAGE_ID });
    const occlusion = warnings.find((w) => w.includes('Counter') && w.includes('Block'));
    expect(occlusion).toBeDefined();
    expect(occlusion).toContain('invisible');
  }, 20_000);

  it('does not warn for a shaded gradient overlay (semi-transparent)', async () => {
    // Common pattern: photo + linear-gradient shade for legibility. The shade
    // covers the photo bbox but at <0.95 opacity, so it's NOT occluding.
    const html = `<div data-name="Card" style="position:relative; width:400px; height:400px; background:#fff;">
      <div data-name="Photo" style="position:absolute; left:0; top:0; width:400px; height:300px; background:#3E4A3C;"></div>
      <div data-name="Shade" style="position:absolute; left:0; top:0; width:400px; height:300px; background:linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 100%);"></div>
    </div>`;

    const { warnings } = await htmlToChanges(html, { pageId: PAGE_ID });
    const occlusion = warnings.find((w) => w.includes('Photo'));
    expect(occlusion).toBeUndefined();
  }, 20_000);
});

describe('integration — chip auto-split with circular radius', () => {
  it('renders a circular icon button (chip + border-radius:50%) as frame + text', async () => {
    // The save-badge pattern from the property card: a 46×46 div with bg,
    // shadow, border-radius:50%, and text content. Pre-fix the radius was
    // dropped silently. After fix: chip-split → frame (with r=23 corners)
    // containing a centred text shape.
    const html = `<div data-name="Card" style="width:200px; height:200px;">
      <div data-name="Save" style="width:46px; height:46px; border-radius:50%; background:#000; color:#fff; font-size:20px; padding:0; display:flex; align-items:center; justify-content:center;">+</div>
    </div>`;

    const { changes, warnings } = await htmlToChanges(html, { pageId: PAGE_ID });
    expect(warnings).toEqual([]);

    const shapes = changes
      .filter((c) => (c as { type: string }).type === 'add-obj')
      .map((c) => (c as unknown as { obj: unknown }).obj as { name?: string; type?: string; r1?: number; width?: number });

    const frame = shapes.find((s) => s.name === 'Save' && s.type === 'frame');
    const text = shapes.find((s) => s.name === 'Save text');
    expect(frame).toBeDefined();
    expect(frame!.r1).toBe(23);
    expect(text).toBeDefined();
  }, 20_000);

  it('centres the glyph inside a flex-centred icon button (avatar pattern)', async () => {
    // The avatar / icon-button regression: a `display:flex; align-items:center;
    // justify-content:center` div with text content is split into frame + text,
    // but pre-fix the synthesized text inherited the parent's computed
    // `text-align: start` and the default `verticalAlign: 'top'`, so the glyph
    // sat at the top-left of the circle instead of the middle.
    //
    // After the fix, chip-split reads the parent's flex centring and writes
    // it onto the synthesized child as `textAlign: 'center'` plus
    // `verticalAlign: 'center'` on the rich-text root.
    const html = `<div data-name="Frame" style="width:200px; height:200px;">
      <div data-name="Avatar" style="width:44px; height:44px; border-radius:50%; background:#1E2128; color:#B6F09C; font-size:14px; font-weight:700; display:flex; align-items:center; justify-content:center;">JF</div>
    </div>`;

    const { changes, warnings } = await htmlToChanges(html, { pageId: PAGE_ID });
    expect(warnings).toEqual([]);

    const text = changes
      .filter((c) => (c as { type: string }).type === 'add-obj')
      .map((c) => (c as unknown as { obj: unknown }).obj as {
        name?: string;
        type?: string;
        content?: { verticalAlign?: string; children?: { children?: { children?: { textAlign?: string }[] }[] }[] };
      })
      .find((s) => s.name === 'Avatar text' && s.type === 'text');

    expect(text).toBeDefined();
    expect(text!.content?.verticalAlign).toBe('center');
    // Drill down to the leaf textAlign — paragraph-set → paragraph → leaf.
    const leaf = text!.content?.children?.[0]?.children?.[0]?.children?.[0];
    expect(leaf?.textAlign).toBe('center');
  }, 20_000);

  it('keeps a non-flex chip with text-align:right anchored to the right', async () => {
    // Negative-control: the new flexCentering branch should not stomp on
    // chips that aren't flex containers. A pill with explicit text-align:right
    // must keep that alignment.
    const html = `<div data-name="Frame" style="width:300px; height:60px;">
      <div data-name="Pill" style="width:200px; height:40px; padding:0 16px; background:#000; color:#fff; text-align:right;">trailing</div>
    </div>`;

    const { changes } = await htmlToChanges(html, { pageId: PAGE_ID });

    const text = changes
      .filter((c) => (c as { type: string }).type === 'add-obj')
      .map((c) => (c as unknown as { obj: unknown }).obj as {
        name?: string;
        type?: string;
        content?: { verticalAlign?: string; children?: { children?: { children?: { textAlign?: string }[] }[] }[] };
      })
      .find((s) => s.name === 'Pill text');

    expect(text).toBeDefined();
    expect(text!.content?.verticalAlign).toBe('top');
    const leaf = text!.content?.children?.[0]?.children?.[0]?.children?.[0];
    expect(leaf?.textAlign).toBe('right');
  }, 20_000);
});

describe('integration — editorial overlapping composition', () => {
  it('preserves z-order, rotation, radius, and shadows across overlapping shapes', async () => {
    // Mini version of the property-card composition. Three overlapping
    // elements: hero photo, rotated stamp on top of photo, dark stats card
    // straddling photo+body. Asserts the geometry the LLM would expect.
    const html = `<div data-name="Card" style="position:relative; width:400px; height:500px; background:#F5F1EA;">
      <div data-name="Photo" style="position:absolute; left:24px; top:24px; width:352px; height:300px; border-radius:20px; background:#3E4A3C;"></div>
      <div data-name="Stamp" style="position:absolute; right:32px; top:120px; transform:rotate(-7deg); padding:10px 16px; background:#FFF; border:2px solid #000;">JUST LISTED</div>
      <div data-name="Stats" style="position:absolute; right:24px; top:280px; width:200px; height:60px; border-radius:14px; background:#000; box-shadow:0 18px 40px -12px rgba(0,0,0,0.4);"></div>
    </div>`;

    const { changes, warnings } = await htmlToChanges(html, { pageId: PAGE_ID });
    expect(warnings).toEqual([]);

    const shapes = changes
      .filter((c) => (c as { type: string }).type === 'add-obj')
      .map((c) => (c as unknown as { obj: unknown }).obj as {
        name?: string;
        x?: number; y?: number; width?: number; height?: number;
        rotation?: number;
        r1?: number; r2?: number; r3?: number; r4?: number;
        shadow?: unknown[];
      });

    const photo = shapes.find((s) => s.name === 'Photo');
    const stamp = shapes.find((s) => s.name === 'Stamp');
    const stats = shapes.find((s) => s.name === 'Stats');

    // Photo: 20px corners.
    expect(photo!.r1).toBe(20);

    // Stamp rotation: CSS rotate(-7deg) → Penpot rotation +7 (sign-flipped per
    // converter convention).
    expect(stamp!.rotation).toBeCloseTo(7, 1);

    // Stats card: 14px radius + a parsed shadow.
    expect(stats!.r1).toBe(14);
    expect(stats!.shadow).toBeDefined();
    expect(stats!.shadow!.length).toBeGreaterThanOrEqual(1);

    // Stats x = 400 - 24 - 200 = 176.
    expect(stats!.x).toBe(176);
  }, 20_000);
});
