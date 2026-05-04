import { describe, it, expect } from 'vitest';
import { renderShape } from './render';
import { convertShape } from './index';
import type { Shape, RectShape, Uuid, HexColor } from '../penpot.types';
import type { ConverterContext } from './types';

const ctx: ConverterContext = {
  resolveImageUrl: (id) => `https://assets.example.com/${id}`,
};

const makeRect = (overrides: Partial<RectShape> = {}): Shape => ({
  id: 'rect-1' as Uuid,
  name: 'Rect',
  type: 'rect',
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  selrect: { x: 0, y: 0, width: 100, height: 50 },
  points: [],
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  parentId: 'frame-1' as Uuid,
  frameId: 'frame-1' as Uuid,
  fills: [{ fillColor: '#aabbcc' as HexColor }],
  ...overrides,
});

describe('renderShape', () => {
  it('renders a rect', () => {
    const html = renderShape(makeRect(), {}, ctx);
    expect(html).toContain('data-id="rect-1"');
    expect(html).toContain('background-color: #aabbcc;');
  });

  it('accepts a parent parameter without changing output', () => {
    makeRect({ id: 'parent' as Uuid });
    const html = renderShape(makeRect(), {}, ctx);
    expect(html).toContain('data-id="rect-1"');
  });

  it('returns empty string for unknown shape type', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unknown = { ...makeRect(), type: 'unknown-type' } as any;
    expect(renderShape(unknown, {}, ctx)).toBe('');
  });

  it('renders component instances like their type (no special handling)', () => {
    const withComponent = { ...makeRect(), componentId: 'comp-1' as Uuid };
    expect(renderShape(withComponent as Shape, {}, ctx)).toContain('data-id="rect-1"');
  });

  it('emits data-name from shape.name (write-mode round-trip identity)', () => {
    expect(renderShape(makeRect({ name: 'My Rect' } as Partial<RectShape>), {}, ctx)).toContain(
      'data-name="My Rect"',
    );
  });

  it('omits data-name when shape.name is empty / whitespace', () => {
    expect(renderShape(makeRect({ name: '   ' } as Partial<RectShape>), {}, ctx)).not.toContain(
      'data-name=',
    );
  });

  it('html-escapes data-name (defensive, names can contain quotes)', () => {
    const html = renderShape(makeRect({ name: 'a "quoted" <name>' } as Partial<RectShape>), {}, ctx);
    expect(html).toContain('data-name="a &quot;quoted&quot; &lt;name&gt;"');
  });

  it('does not add the legacy data-penpot-name attribute', () => {
    expect(renderShape(makeRect({ name: 'My Rect' } as Partial<RectShape>), {}, ctx)).not.toContain(
      'data-penpot-name',
    );
  });

  it('adds data-penpot-locked when shape is locked', () => {
    const locked = { ...makeRect(), locked: true } as Shape;
    expect(renderShape(locked, {}, ctx)).toContain('data-penpot-locked="true"');
  });

  it('adds data-penpot-blocked when shape is blocked', () => {
    const blocked = { ...makeRect(), blocked: true } as Shape;
    expect(renderShape(blocked, {}, ctx)).toContain('data-penpot-blocked="true"');
  });

  it('does not add locked/blocked attrs when not set', () => {
    const html = renderShape(makeRect(), {}, ctx);
    expect(html).not.toContain('data-penpot-locked');
    expect(html).not.toContain('data-penpot-blocked');
  });
});

describe('convertShape', () => {
  it('renders the shape with position: relative', async () => {
    const { html } = await convertShape(makeRect(), {}, ctx);
    expect(html).toContain('position: relative;');
    expect(html).not.toContain('position: absolute;');
  });

  it('does not emit left/top for the root shape', async () => {
    const { html } = await convertShape(makeRect({ x: 50, y: 100 } as Partial<RectShape>), {}, ctx);
    expect(html).not.toContain('left: 50px;');
    expect(html).not.toContain('top: 100px;');
  });

  it('includes data-id', async () => {
    const { html } = await convertShape(makeRect(), {}, ctx);
    expect(html).toContain('data-id="rect-1"');
  });

  it('does not include html/body wrapper', async () => {
    const { html } = await convertShape(makeRect(), {}, ctx);
    expect(html).not.toContain('<html');
    expect(html).not.toContain('<body');
  });
});

/**
 * Stable-attribute-order contract.
 *
 * Downstream consumers (`@penpot-tools/converter/shape-code`,
 * `@penpot-tools/html-to-penpot`) parse this output with regex — they rely
 * on `data-id` appearing before `style`, with `data-type` between them and
 * any injected `data-name` / `data-penpot-*` PRECEDING `data-id`. A future
 * tweak to the emission order would silently break the orphan-style /
 * class-extraction passes that anchor on `data-id="…"…style="…"`.
 *
 * If you need to change the order on purpose, update the dependent regexes
 * (search for `data-id="` in `shape-code.ts` and `packages/html-to-penpot/`)
 * AND loosen these assertions in the same commit.
 */
describe('contract: shape wrapper attribute order', () => {
  function attrOrder(html: string): string[] {
    const m = /<\w+\s+([^>]*)>/.exec(html);
    if (!m) throw new Error(`no opening tag in: ${html.slice(0, 60)}`);
    return [...m[1]!.matchAll(/(\b[\w-]+)=/g)].map((r) => r[1]!);
  }

  it('emits data-name → data-id → data-type → style on a named rect', async () => {
    const { html } = await convertShape(makeRect({ name: 'Cancel' }), {}, ctx);
    expect(attrOrder(html)).toEqual(['data-name', 'data-id', 'data-type', 'style']);
  });

  it('still emits data-id → data-type → style when the name is missing', () => {
    const html = renderShape(makeRect({ name: '' } as Partial<RectShape>), {}, ctx);
    expect(attrOrder(html)).toEqual(['data-id', 'data-type', 'style']);
  });

  it('keeps data-id before style when editor-only flags are present', () => {
    const locked = { ...makeRect({ name: 'Locked' }), locked: true } as Shape;
    const order = attrOrder(renderShape(locked, {}, ctx));
    expect(order.indexOf('data-id')).toBeLessThan(order.indexOf('style'));
    expect(order.indexOf('data-name')).toBeLessThan(order.indexOf('data-id'));
    expect(order.indexOf('data-penpot-locked')).toBeLessThan(order.indexOf('data-id'));
  });
});
