import { describe, it, expect } from 'vitest';
import { renderBool } from './bool';
import type { BoolShape, Uuid, HexColor } from '../../penpot.types';
import type { ConverterContext } from '../types';

const ctx: ConverterContext = {
  resolveImageUrl: (id) => `https://assets.example.com/${id}`,
};

const makeBool = (overrides: Partial<BoolShape> = {}): BoolShape => ({
  id: 'bool-1' as Uuid,
  name: 'BoolShape',
  type: 'bool',
  boolType: 'union',
  shapes: [],
  content: 'M 0 0 L 100 0 L 100 50 Z',
  x: 10,
  y: 20,
  width: 100,
  height: 50,
  selrect: { x: 10, y: 20, width: 100, height: 50 },
  points: [],
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  parentId: 'parent-1' as Uuid,
  frameId: 'frame-1' as Uuid,
  ...overrides,
});

describe('renderBool', () => {
  it('renders an svg element', () => {
    const html = renderBool(makeBool(), ctx);
    expect(html).toMatch(/^<svg/);
    expect(html).toMatch(/<\/svg>$/);
  });

  it('includes data-id attribute', () => {
    expect(renderBool(makeBool({ id: 'my-bool' as Uuid }), ctx)).toContain('data-id="my-bool"');
  });

  it('includes data-type attribute', () => {
    expect(renderBool(makeBool(), ctx)).toContain('data-type="bool"');
  });

  it('sets svg width and height from bounding box', () => {
    const html = renderBool(makeBool({ width: 100, height: 50 }), ctx);
    expect(html).toContain('width="100"');
    expect(html).toContain('height="50"');
  });

  it('positions absolutely using style', () => {
    const html = renderBool(makeBool({ x: 10, y: 20 }), ctx);
    expect(html).toContain('position: absolute;');
    expect(html).toContain('left: 10px;');
    expect(html).toContain('top: 20px;');
  });

  it('contains a path element with the content', () => {
    const html = renderBool(makeBool({ content: 'M 0 0 L 50 50' }), ctx);
    expect(html).toContain('<path');
    expect(html).toContain('M 0 0 L 50 50');
  });

  it('translates path by -x, -y', () => {
    expect(renderBool(makeBool({ x: 10, y: 20 }), ctx)).toContain('translate(-10, -20)');
  });

  it('applies fill color from fills', () => {
    const html = renderBool(makeBool({ fills: [{ fillColor: '#ff0000' as HexColor }] }), ctx);
    expect(html).toContain('fill="#ff0000"');
  });

  it('applies stroke color from strokes', () => {
    const html = renderBool(
      makeBool({ strokes: [{ strokeColor: '#0000ff' as HexColor, strokeWidth: 2 }] }),
      ctx,
    );
    expect(html).toContain('stroke="#0000ff"');
  });

  it('uses fill=none when no fills', () => {
    expect(renderBool(makeBool({ fills: [] }), ctx)).toContain('fill="none"');
  });

  it('includes opacity style when opacity is set', () => {
    expect(renderBool(makeBool({ opacity: 0.5 }), ctx)).toContain('opacity: 0.5;');
  });

  it('includes display: none when hidden', () => {
    expect(renderBool(makeBool({ hidden: true }), ctx)).toContain('display: none;');
  });

  it('has no class attribute', () => {
    expect(renderBool(makeBool(), ctx)).not.toContain('class=');
  });
});
