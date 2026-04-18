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

  it('positions the svg absolutely using style', () => {
    const html = renderPath(makePath({ x: 10, y: 20 }), ctx);
    expect(html).toContain('position: absolute;');
    expect(html).toContain('left: 10px;');
    expect(html).toContain('top: 20px;');
  });

  it('contains a path element with the content', () => {
    const html = renderPath(makePath({ content: 'M 0 0 L 50 50' }), ctx);
    expect(html).toContain('<path');
    expect(html).toContain('M 0 0 L 50 50');
  });

  it('applies fill color from fills', () => {
    const html = renderPath(makePath({ fills: [{ fillColor: '#ff0000' as HexColor }] }), ctx);
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

  it('includes opacity style when opacity is set', () => {
    const html = renderPath(makePath({ opacity: 0.5 }), ctx);
    expect(html).toContain('opacity: 0.5;');
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

  it('falls back to selrect when x/y/width/height are null', () => {
    const html = renderPath(
      makePath({
        x: null as unknown as number,
        y: null as unknown as number,
        width: null as unknown as number,
        height: null as unknown as number,
        selrect: { x: 1601, y: 530, width: 52, height: 133 },
      }),
      ctx,
    );
    expect(html).toContain('viewBox="1601 530 52 133"');
    expect(html).toContain('width="52"');
    expect(html).toContain('height="133"');
  });

  it('renders line-arrow strokeCapStart as marker-start with defs', () => {
    const html = renderPath(
      makePath({
        strokes: [
          {
            strokeColor: '#eb7ff5' as HexColor,
            strokeOpacity: 1,
            strokeWidth: 2,
            strokeCapStart: 'line-arrow',
          },
        ],
      }),
      ctx,
    );
    expect(html).toContain('<defs>');
    expect(html).toContain('<marker');
    expect(html).toContain('id="marker-path-1-start"');
    expect(html).toContain('orient="auto-start-reverse"');
    // line-arrow path
    expect(html).toContain('M 0.5 0.5 L 3 3 L 0.5 5.5 L 0 5 L 2 3 L 0 1 z');
    expect(html).toContain('marker-start:url(#marker-path-1-start)');
    expect(html).not.toContain('marker-end');
  });

  it('renders line-arrow strokeCapEnd as marker-end with defs', () => {
    const html = renderPath(
      makePath({
        strokes: [
          {
            strokeColor: '#eb7ff5' as HexColor,
            strokeWidth: 2,
            strokeCapEnd: 'line-arrow',
          },
        ],
      }),
      ctx,
    );
    expect(html).toContain('id="marker-path-1-end"');
    expect(html).toContain('marker-end:url(#marker-path-1-end)');
    expect(html).not.toContain('marker-start:');
  });

  it('renders both strokeCapStart and strokeCapEnd markers', () => {
    const html = renderPath(
      makePath({
        strokes: [
          {
            strokeColor: '#ff0000' as HexColor,
            strokeWidth: 2,
            strokeCapStart: 'line-arrow',
            strokeCapEnd: 'triangle-arrow',
          },
        ],
      }),
      ctx,
    );
    expect(html).toContain('id="marker-path-1-start"');
    expect(html).toContain('id="marker-path-1-end"');
    expect(html).toContain('marker-start:url(#marker-path-1-start)');
    expect(html).toContain('marker-end:url(#marker-path-1-end)');
  });

  it('renders triangle-arrow marker with correct path', () => {
    const html = renderPath(
      makePath({
        strokes: [{ strokeColor: '#0000ff' as HexColor, strokeCapStart: 'triangle-arrow' }],
      }),
      ctx,
    );
    expect(html).toContain('M 0 0 L 6 3 L 0 6 z');
  });

  it('renders circle-marker with circle element', () => {
    const html = renderPath(
      makePath({
        strokes: [{ strokeColor: '#0000ff' as HexColor, strokeCapStart: 'circle-marker' }],
      }),
      ctx,
    );
    expect(html).toContain('<circle');
    expect(html).toContain('r="2.5"');
  });

  it('renders square-marker with rect element', () => {
    const html = renderPath(
      makePath({
        strokes: [{ strokeColor: '#0000ff' as HexColor, strokeCapStart: 'square-marker' }],
      }),
      ctx,
    );
    expect(html).toContain('<rect');
  });

  it('renders diamond-marker with diamond path', () => {
    const html = renderPath(
      makePath({
        strokes: [{ strokeColor: '#0000ff' as HexColor, strokeCapStart: 'diamond-marker' }],
      }),
      ctx,
    );
    expect(html).toContain('M 3 0 L 6 3 L 3 6 L 0 3 z');
  });

  it('renders round cap as stroke-linecap, not a marker', () => {
    const html = renderPath(
      makePath({
        strokes: [{ strokeColor: '#0000ff' as HexColor, strokeCapStart: 'round' }],
      }),
      ctx,
    );
    expect(html).toContain('stroke-linecap:round');
    expect(html).not.toContain('<marker');
    expect(html).not.toContain('marker-start');
  });

  it('renders square cap as stroke-linecap, not a marker', () => {
    const html = renderPath(
      makePath({
        strokes: [{ strokeColor: '#0000ff' as HexColor, strokeCapStart: 'square' }],
      }),
      ctx,
    );
    expect(html).toContain('stroke-linecap:square');
    expect(html).not.toContain('<marker');
  });

  it('combines image fill pattern and stroke marker in a single defs block', () => {
    const html = renderPath(
      makePath({
        fills: [
          {
            fillImage: {
              id: 'img-1' as Uuid,
              width: 100,
              height: 50,
              mtype: 'image/png',
            },
          },
        ],
        strokes: [{ strokeColor: '#ff0000' as HexColor, strokeCapStart: 'line-arrow' }],
      }),
      ctx,
    );
    // Only one <defs> block
    const defsMatches = html.match(/<defs>/g) ?? [];
    expect(defsMatches).toHaveLength(1);
    expect(html).toContain('<pattern');
    expect(html).toContain('<marker');
  });

  it('canvas-top-level rotated path uses only translate, no CSS rotation', () => {
    // Path content coordinates are already in page-absolute space — rotation is
    // baked into the path data. Only a translate is needed for placement; applying
    // CSS rotate/matrix would double-transform and flip the shape.
    const canvasCtx: ConverterContext = {
      ...ctx,
      _isCanvasTopLevel: true,
    };
    const html = renderPath(
      makePath({
        x: null as unknown as number,
        y: null as unknown as number,
        width: null as unknown as number,
        height: null as unknown as number,
        selrect: { x: 1601, y: 530, width: 52, height: 133 },
        rotation: 331,
        transform: { a: -0.8775, b: 0.4795, c: -0.4795, d: -0.8775, e: 0, f: 0 },
      }),
      canvasCtx,
    );
    const styleMatch = /style="([^"]*)"/.exec(html);
    expect(styleMatch).not.toBeNull();
    const style = styleMatch![1];
    // only translate — no rotation or matrix transform
    expect(style).toContain('translate(1601px, 530px)');
    expect(style).not.toContain('rotate(');
    expect(style).not.toContain('matrix(');
  });
});
