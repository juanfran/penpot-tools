/**
 * Property-card session regression: an outer wrapper with bg/radius/shadow
 * holding several absolutely-positioned children should land in Penpot as a
 * SINGLE board carrying the wrapper's chrome — not a synthetic white frame
 * around it that swallowed the user's design intent.
 *
 * Pre-fix the converter always emitted a synthetic "New design" frame around
 * the user's tree, hardcoding white fill and stripping the wrapper's
 * background/radius/shadow. The user's screenshot showed a flat white card
 * because their cream wrapper sat invisibly inside the synthetic frame after
 * Penpot's reg-objects collapsed the synthetic to fit children-only bounds.
 */
import { describe, expect, it } from 'vitest';
import type { Uuid } from '@penpot-tools/converter/types';
import { htmlToChanges } from './index';

const PAGE_ID = '00000000-0000-0000-0000-000000000001' as Uuid;
const PAGE_ROOT_ID = '00000000-0000-0000-0000-000000000000';

interface AnyShape {
  id: string;
  name?: string;
  type?: string;
  parentId?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fills?: Array<{ fillColor?: string; fillOpacity?: number }>;
  shadow?: unknown[];
  r1?: number;
  r2?: number;
  r3?: number;
  r4?: number;
}

function shapesFromBundle(changes: Array<unknown>): AnyShape[] {
  return changes
    .filter((c) => (c as { type: string }).type === 'add-obj')
    .map((c) => (c as unknown as { obj: AnyShape }).obj);
}

const CARD_HTML = `<div data-name="property-card" style="position:relative; width:560px; height:720px; background:#FAF7F2; border-radius:18px; box-shadow:0 24px 48px rgba(26,26,26,0.12); box-sizing:border-box;">

  <div data-name="hero-image" style="position:absolute; top:40px; left:40px; width:380px; height:360px; border-radius:12px; background:linear-gradient(135deg, #C8956D 0%, #8B5E3C 48%, #3E4F3A 100%);"></div>

  <div data-name="address-pill" style="position:absolute; top:24px; left:300px; width:236px; height:88px; padding:18px 22px; background:#FFFFFF; border-radius:14px; box-sizing:border-box;">
    <div data-name="address-line" style="font-size:18px; font-weight:600;">144 Orchard St</div>
  </div>

  <div data-name="price-plate" style="position:absolute; top:300px; left:240px; width:280px; height:128px; padding:22px 26px; background:#1A1A1A; border-radius:14px; box-sizing:border-box;">
    <div data-name="price-value" style="font-size:32px; color:#FAF7F2;">$2,450,000</div>
  </div>

  <div data-name="cta" style="position:absolute; top:628px; left:344px; width:184px; height:52px; background:#1A1A1A; border-radius:999px; color:#FAF7F2;">Schedule viewing</div>

</div>`;

describe('integration — property-card root promotion', () => {
  it('promotes the single top-level container to the board', async () => {
    const { changes, rootShapeId, rootShapeName } = await htmlToChanges(CARD_HTML, {
      pageId: PAGE_ID,
    });
    const shapes = shapesFromBundle(changes);

    // Exactly one shape with parentId = page root: the user's wrapper. No
    // synthetic frame in front of it.
    const tops = shapes.filter((s) => s.parentId === PAGE_ROOT_ID);
    expect(tops).toHaveLength(1);
    expect(tops[0]!.name).toBe('property-card');
    expect(tops[0]!.id).toBe(rootShapeId);
    expect(rootShapeName).toBe('property-card');
  }, 20_000);

  it('preserves the wrapper background, radius, shadow, and dimensions', async () => {
    const { changes } = await htmlToChanges(CARD_HTML, { pageId: PAGE_ID });
    const wrapper = shapesFromBundle(changes).find((s) => s.name === 'property-card')!;

    expect(wrapper.type).toBe('frame');
    expect(wrapper.width).toBe(560);
    expect(wrapper.height).toBe(720);
    expect(wrapper.fills).toEqual(
      expect.arrayContaining([expect.objectContaining({ fillColor: '#FAF7F2' })]),
    );
    expect(wrapper.r1).toBe(18);
    expect(wrapper.shadow).toBeDefined();
    expect(wrapper.shadow!.length).toBeGreaterThanOrEqual(1);
  }, 20_000);

  it('keeps absolute children at their authored x/y inside the wrapper', async () => {
    const { changes } = await htmlToChanges(CARD_HTML, { pageId: PAGE_ID });
    const shapes = shapesFromBundle(changes);
    const wrapper = shapes.find((s) => s.name === 'property-card')!;
    const hero = shapes.find((s) => s.name === 'hero-image')!;
    const pill = shapes.find((s) => s.name === 'address-pill')!;
    const cta = shapes.find((s) => s.name === 'cta')!;

    // Children are page-absolute; subtract wrapper origin to recover the
    // per-card-edge offset the LLM authored (40px breathing room).
    expect(hero.x! - wrapper.x!).toBe(40);
    expect(hero.y! - wrapper.y!).toBe(40);
    expect(pill.x! - wrapper.x!).toBe(300);
    expect(pill.y! - wrapper.y!).toBe(24);
    expect(cta.x! - wrapper.x!).toBe(344);
    expect(cta.y! - wrapper.y!).toBe(628);
  }, 20_000);

  it('uses caller-provided rootName as the board layer name', async () => {
    // Explicit `rootName` (the MCP `name` parameter) overrides the top
    // element's `data-name` — the LLM sometimes wants a board named
    // independently from the layer authored in HTML.
    const { changes, rootShapeName } = await htmlToChanges(CARD_HTML, {
      pageId: PAGE_ID,
      rootName: 'Property listing — Orchard',
    });
    const wrapper = shapesFromBundle(changes).find(
      (s) => s.parentId === PAGE_ROOT_ID,
    )!;
    expect(wrapper.name).toBe('Property listing — Orchard');
    expect(rootShapeName).toBe('Property listing — Orchard');
  }, 20_000);

  it('keeps a synthetic board when the user authored multiple top-level elements', async () => {
    // Two siblings with no shared wrapper — the synthetic frame is still
    // needed so they share a parent on the page.
    const html = `<div data-name="A" style="width:100px; height:100px; background:#000;"></div>
                  <div data-name="B" style="width:100px; height:100px; background:#0F0; margin-left:120px;"></div>`;
    const { changes, rootShapeName } = await htmlToChanges(html, {
      pageId: PAGE_ID,
      rootName: 'Pair',
    });
    const shapes = shapesFromBundle(changes);
    const tops = shapes.filter((s) => s.parentId === PAGE_ROOT_ID);
    expect(tops).toHaveLength(1);
    expect(tops[0]!.name).toBe('Pair');
    expect(rootShapeName).toBe('Pair');
    // The synthetic board contains the two siblings.
    const a = shapes.find((s) => s.name === 'A')!;
    const b = shapes.find((s) => s.name === 'B')!;
    expect(a.parentId).toBe(tops[0]!.id);
    expect(b.parentId).toBe(tops[0]!.id);
  }, 20_000);
});
