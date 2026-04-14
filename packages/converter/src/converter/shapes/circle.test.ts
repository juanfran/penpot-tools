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

  it('includes absolute positioning classes', () => {
    const html = renderCircle(makeCircle({ x: 10, y: 20, width: 80, height: 80 }), null, ctx);
    expect(html).toContain('absolute');
    expect(html).toContain('left-[10px]');
    expect(html).toContain('top-[20px]');
    expect(html).toContain('w-[80px]');
    expect(html).toContain('h-[80px]');
  });

  it('uses rounded-full when width equals height (perfect circle)', () => {
    const html = renderCircle(makeCircle({ width: 80, height: 80 }), null, ctx);
    expect(html).toContain('rounded-full');
    expect(html).not.toContain('border-radius: 50%');
  });

  it('uses rounded-[50%] class for ellipse (width !== height)', () => {
    const html = renderCircle(makeCircle({ width: 120, height: 80 }), null, ctx);
    expect(html).toContain('rounded-[50%]');
    expect(html).not.toContain('rounded-full');
    expect(html).not.toContain('border-radius: 50%');
  });

  it('includes fill class', () => {
    const html = renderCircle(
      makeCircle({ fills: [{ fillColor: '#ff0000' as HexColor }] }),
      null,
      ctx,
    );
    expect(html).toContain('bg-[#ff0000]');
  });

  it('includes opacity class', () => {
    const html = renderCircle(makeCircle({ opacity: 0.5 }), null, ctx);
    expect(html).toContain('opacity-[50%]');
  });

  it('includes hidden class when hidden', () => {
    const html = renderCircle(makeCircle({ hidden: true }), null, ctx);
    expect(html).toContain('hidden');
  });

  it('includes blend mode class', () => {
    const html = renderCircle(makeCircle({ blendMode: 'multiply' }), null, ctx);
    expect(html).toContain('mix-blend-multiply');
  });
});
