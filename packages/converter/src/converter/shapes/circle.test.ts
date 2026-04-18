import { describe, it, expect } from 'vitest';
import { renderCircle } from './circle';
import type { CircleShape, Uuid, HexColor } from '../../penpot.types';
import type { ConverterContext } from '../types';

const ctx: ConverterContext = {
  resolveImageUrl: (id) => `https://assets.example.com/${id}`,
};

const makeCircle = (overrides: Partial<CircleShape> = {}): CircleShape => ({
  id: 'circle-1' as Uuid,
  name: 'Circle',
  type: 'circle',
  x: 10,
  y: 20,
  width: 80,
  height: 80,
  selrect: { x: 10, y: 20, width: 80, height: 80 },
  points: [],
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  parentId: 'parent-1' as Uuid,
  frameId: 'frame-1' as Uuid,
  ...overrides,
});

describe('renderCircle', () => {
  it('renders a div element', () => {
    const html = renderCircle(makeCircle(), null, ctx);
    expect(html).toMatch(/^<div/);
    expect(html).toMatch(/<\/div>$/);
  });

  it('includes data-id attribute with shape id', () => {
    const html = renderCircle(makeCircle({ id: 'my-circle' as Uuid }), null, ctx);
    expect(html).toContain('data-id="my-circle"');
  });

  it('includes absolute positioning in style', () => {
    const html = renderCircle(makeCircle({ x: 10, y: 20, width: 80, height: 80 }), null, ctx);
    expect(html).toContain('position: absolute;');
    expect(html).toContain('left: 10px;');
    expect(html).toContain('top: 20px;');
    expect(html).toContain('width: 80px;');
    expect(html).toContain('height: 80px;');
  });

  it('uses border-radius: 50% for both circles and ellipses', () => {
    const circle = renderCircle(makeCircle({ width: 80, height: 80 }), null, ctx);
    expect(circle).toContain('border-radius: 50%;');

    const ellipse = renderCircle(makeCircle({ width: 120, height: 80 }), null, ctx);
    expect(ellipse).toContain('border-radius: 50%;');
  });

  it('includes fill as background-color', () => {
    const html = renderCircle(
      makeCircle({ fills: [{ fillColor: '#ff0000' as HexColor }] }),
      null,
      ctx,
    );
    expect(html).toContain('background-color: #ff0000;');
  });

  it('includes opacity style', () => {
    expect(renderCircle(makeCircle({ opacity: 0.5 }), null, ctx)).toContain('opacity: 0.5;');
  });

  it('includes display: none when hidden', () => {
    expect(renderCircle(makeCircle({ hidden: true }), null, ctx)).toContain('display: none;');
  });

  it('includes blend mode style', () => {
    expect(renderCircle(makeCircle({ blendMode: 'multiply' }), null, ctx)).toContain(
      'mix-blend-mode: multiply;',
    );
  });

  it('has no class attribute', () => {
    expect(renderCircle(makeCircle(), null, ctx)).not.toContain('class=');
  });
});
