import { describe, it, expect } from 'vitest';
import { renderShape } from './render';
import { convertShape } from './index';
import type { Shape, Uuid, HexColor } from '../penpot.types';
import type { ConverterContext } from './types';

const ctx: ConverterContext = {
  resolveImageUrl: (id) => `https://assets.example.com/${id}`,
};

const makeRect = (overrides: Partial<Shape> = {}): Shape => ({
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

  it('does not add data-penpot-name attribute', () => {
    expect(renderShape(makeRect({ name: 'My Rect' } as Partial<Shape>), {}, ctx)).not.toContain('data-penpot-name');
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
    const { html } = await convertShape(makeRect({ x: 50, y: 100 } as Partial<Shape>), {}, ctx);
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
