import { describe, it, expect } from 'vitest';
import { renderPath } from './path';
import type { PathShape, Uuid, HexColor } from '../../penpot.types';
import type { ConverterContext } from '../types';

const ctx: ConverterContext = {
  resolveImageUrl: (id) => `https://assets.example.com/${id}`,
};

const makePath = (overrides: Partial<PathShape> = {}): PathShape => ({
  id: 'path-1' as Uuid,
  name: 'Path',
  type: 'path',
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

describe('renderPath', () => {
  it('renders an svg element', () => {
    const html = renderPath(makePath(), ctx);
    expect(html).toMatch(/^<svg/);
    expect(html).toMatch(/<\/svg>$/);
  });

  it('includes data-id attribute', () => {
    const html = renderPath(makePath({ id: 'my-path' as Uuid }), ctx);
    expect(html).toContain('data-id="my-path"');
  });

  it('sets svg width and height from shape bounding box', () => {
    const html = renderPath(makePath({ width: 100, height: 50 }), ctx);
    expect(html).toContain('width="100"');
    expect(html).toContain('height="50"');
  });

  it('uses viewBox to map page coordinates to svg viewport', () => {
    const html = renderPath(makePath({ x: 10, y: 20, width: 100, height: 50 }), ctx);
    expect(html).toContain('viewBox="10 20 100 50"');
    // path uses original page coordinates — no transform needed
    expect(html).not.toContain('transform=');
  });

  it('positions the svg absolutely', () => {
    const html = renderPath(makePath({ x: 10, y: 20 }), ctx);
    expect(html).toContain('absolute');
    expect(html).toContain('left-[10px]');
    expect(html).toContain('top-[20px]');
  });

  it('contains a path element with the content', () => {
    const html = renderPath(makePath({ content: 'M 0 0 L 50 50' }), ctx);
    expect(html).toContain('<path');
    expect(html).toContain('M 0 0 L 50 50');
  });

  it('applies fill color from fills', () => {
    const html = renderPath(
      makePath({ fills: [{ fillColor: '#ff0000' as HexColor }] }),
      ctx,
    );
    expect(html).toContain('fill="#ff0000"');
  });

  it('applies stroke color from strokes', () => {
    const html = renderPath(
      makePath({
        strokes: [{ strokeColor: '#0000ff' as HexColor, strokeWidth: 2 }],
      }),
      ctx,
    );
    expect(html).toContain('stroke="#0000ff"');
  });

  it('uses fill=none when no fills are present', () => {
    const html = renderPath(makePath({ fills: [] }), ctx);
    expect(html).toContain('fill="none"');
  });

  it('includes opacity class when opacity is set', () => {
    const html = renderPath(makePath({ opacity: 0.5 }), ctx);
    expect(html).toContain('opacity-[50%]');
  });

  it('renders image fill as svg pattern anchored to page-absolute bounding box', () => {
    // shape at x=10, y=20, 100x50. Pattern must use page coords so
    // preserveAspectRatio works correctly with the viewBox coordinate system.
    const html = renderPath(
      makePath({
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        fills: [
          {
            fillImage: {
              id: 'abc-123' as Uuid,
              width: 200,
              height: 100,
              mtype: 'image/jpeg',
            },
            fillOpacity: 1,
          },
        ],
      }),
      ctx,
    );
    expect(html).toContain('<defs>');
    expect(html).toContain('<pattern');
    expect(html).toContain('patternUnits="userSpaceOnUse"');
    // pattern anchored to page-absolute bounding box
    expect(html).toContain('x="10"');
    expect(html).toContain('y="20"');
    expect(html).toContain('width="100"');
    expect(html).toContain('height="50"');
    expect(html).toContain('<image');
    expect(html).toContain('href="https://assets.example.com/abc-123"');
    // image covers the pattern tile with center alignment
    expect(html).toContain('preserveAspectRatio="xMidYMid slice"');
    expect(html).toContain('fill="url(#img-path-1)"');
  });
});
