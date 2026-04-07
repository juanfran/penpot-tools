import { describe, it, expect } from 'vitest';
import { renderRect } from './rect';
import type { RectShape, Uuid, HexColor } from '../../penpot.types';
import type { ConverterContext } from '../types';

const ctx: ConverterContext = {
  resolveImageUrl: (id) => `https://assets.example.com/${id}`,
};

const makeRect = (overrides: Partial<RectShape> = {}): RectShape => ({
  id: 'rect-1' as Uuid,
  name: 'Rectangle',
  type: 'rect',
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

describe('renderRect', () => {
  it('renders a div element', () => {
    const html = renderRect(makeRect(), null, ctx);
    expect(html).toMatch(/^<div/);
    expect(html).toMatch(/<\/div>$/);
  });

  it('includes the penpot shape ID as data-id attribute', () => {
    const html = renderRect(makeRect({ id: 'abc-123' as Uuid }), null, ctx);
    expect(html).toContain('data-id="abc-123"');
  });

  it('includes absolute positioning classes', () => {
    const html = renderRect(
      makeRect({ x: 10, y: 20, width: 100, height: 50 }),
      null,
      ctx,
    );
    expect(html).toContain('absolute');
    expect(html).toContain('left-[10px]');
    expect(html).toContain('top-[20px]');
    expect(html).toContain('w-[100px]');
    expect(html).toContain('h-[50px]');
  });

  it('includes solid fill class', () => {
    const html = renderRect(
      makeRect({ fills: [{ fillColor: '#ff0000' as HexColor }] }),
      null,
      ctx,
    );
    expect(html).toContain('bg-[#ff0000]');
  });

  it('includes fill as inline style for gradient', () => {
    const html = renderRect(
      makeRect({
        fills: [
          {
            fillColorGradient: {
              type: 'linear',
              startX: 0,
              startY: 0,
              endX: 1,
              endY: 0,
              width: 1,
              stops: [
                { color: '#ff0000' as HexColor, opacity: 1, offset: 0 },
                { color: '#0000ff' as HexColor, opacity: 1, offset: 1 },
              ],
            },
          },
        ],
      }),
      null,
      ctx,
    );
    expect(html).toContain('linear-gradient');
  });

  it('includes opacity class when opacity is set', () => {
    const html = renderRect(makeRect({ opacity: 0.5 }), null, ctx);
    expect(html).toContain('opacity-[50%]');
  });

  it('includes hidden class when hidden', () => {
    const html = renderRect(makeRect({ hidden: true }), null, ctx);
    expect(html).toContain('hidden');
  });

  it('includes corner radius class', () => {
    const html = renderRect(
      makeRect({ r1: 8, r2: 8, r3: 8, r4: 8 }),
      null,
      ctx,
    );
    expect(html).toContain('rounded-[8px]');
  });

  it('is self-contained with no children inside', () => {
    const html = renderRect(makeRect(), null, ctx);
    expect(html).toBe(html.trim());
    // div with no inner content
    expect(html).toMatch(/<div[^>]*><\/div>/);
  });
});
