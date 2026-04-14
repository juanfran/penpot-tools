import { describe, it, expect } from 'vitest';
import { renderFrame } from './frame';
import type { FrameShape, Shape, Uuid, HexColor } from '../../penpot.types';
import type { ConverterContext } from '../types';

const ctx: ConverterContext = {
  resolveImageUrl: (id) => `https://assets.example.com/${id}`,
};

const makeFrame = (overrides: Partial<FrameShape> = {}): FrameShape => ({
  id: 'frame-1' as Uuid,
  name: 'Frame',
  type: 'frame',
  x: 0,
  y: 0,
  width: 400,
  height: 300,
  shapes: [],
  selrect: { x: 0, y: 0, width: 400, height: 300 },
  points: [],
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  parentId: 'frame-1' as Uuid, // root frame: parentId === id
  frameId: 'frame-1' as Uuid,
  ...overrides,
});

const makeChild = (id: string): Shape => ({
  id: id as Uuid,
  name: 'Rect',
  type: 'rect',
  x: 10,
  y: 10,
  width: 50,
  height: 50,
  selrect: { x: 10, y: 10, width: 50, height: 50 },
  points: [],
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  parentId: 'frame-1' as Uuid,
  frameId: 'frame-1' as Uuid,
  fills: [{ fillColor: '#ff0000' as HexColor }],
});

describe('renderFrame', () => {
  it('renders a div element', () => {
    const html = renderFrame(makeFrame(), [], {}, ctx);
    expect(html).toMatch(/^<div/);
    expect(html).toMatch(/<\/div>$/);
  });

  it('includes data-id attribute', () => {
    const html = renderFrame(
      makeFrame({ id: 'my-frame' as Uuid }),
      [],
      {},
      ctx,
    );
    expect(html).toContain('data-id="my-frame"');
  });

  it('root frame (parentId === id) uses relative positioning', () => {
    const frame = makeFrame(); // parentId === id
    const html = renderFrame(frame, [], {}, ctx);
    expect(html).toContain('relative');
    expect(html).not.toContain('absolute');
  });

  it('nested frame uses absolute positioning', () => {
    const frame = makeFrame({ parentId: 'other-frame' as Uuid });
    const html = renderFrame(frame, [], {}, ctx);
    expect(html).toContain('absolute');
  });

  it('includes width and height classes', () => {
    const html = renderFrame(
      makeFrame({ width: 400, height: 300 }),
      [],
      {},
      ctx,
    );
    expect(html).toContain('w-[400px]');
    expect(html).toContain('h-[300px]');
  });

  it('includes overflow-hidden when clipContent is true', () => {
    const html = renderFrame(makeFrame({ clipContent: true }), [], {}, ctx);
    expect(html).toContain('overflow-hidden');
  });

  it('does not include overflow-hidden when clipContent is false', () => {
    const html = renderFrame(makeFrame({ clipContent: false }), [], {}, ctx);
    expect(html).not.toContain('overflow-hidden');
  });

  it('does not include overflow-hidden when showContent is true', () => {
    const html = renderFrame(makeFrame({ showContent: true }), [], {}, ctx);
    expect(html).not.toContain('overflow-hidden');
  });

  it('renders children inside', () => {
    const child = makeChild('child-1');
    const objects: Record<string, Shape> = { 'child-1': child };
    const html = renderFrame(makeFrame(), [child], objects, ctx);
    expect(html).toContain('data-id="child-1"');
  });

  it('applies fills', () => {
    const html = renderFrame(
      makeFrame({ fills: [{ fillColor: '#ffffff' as HexColor }] }),
      [],
      {},
      ctx,
    );
    expect(html).toContain('bg-[#ffffff]');
  });

  it('includes opacity class', () => {
    const html = renderFrame(makeFrame({ opacity: 0.5 }), [], {}, ctx);
    expect(html).toContain('opacity-[50%]');
  });

  it('includes hidden class when hidden', () => {
    const html = renderFrame(makeFrame({ hidden: true }), [], {}, ctx);
    expect(html).toContain('hidden');
  });

  it('includes corner radius class', () => {
    const html = renderFrame(
      makeFrame({ r1: 8, r2: 8, r3: 8, r4: 8 }),
      [],
      {},
      ctx,
    );
    expect(html).toContain('rounded-[8px]');
  });

  describe('flex layout mode', () => {
    it('emits flex class when layoutType is flex', () => {
      const html = renderFrame(
        makeFrame({ layoutType: 'flex', layoutFlexDir: 'row' }),
        [],
        {},
        ctx,
      );
      expect(html).toContain('flex');
    });

    it('emits flex-col for column direction', () => {
      const html = renderFrame(
        makeFrame({ layoutType: 'flex', layoutFlexDir: 'column' }),
        [],
        {},
        ctx,
      );
      expect(html).toContain('flex-col');
    });

    it('emits gap class when layoutRowGap and layoutColumnGap are equal', () => {
      const html = renderFrame(
        makeFrame({
          layoutType: 'flex',
          layoutRowGap: 10,
          layoutColumnGap: 10,
        }),
        [],
        {},
        ctx,
      );
      expect(html).toContain('gap-[10px]');
    });

    it('emits layout-item sizing classes for children', () => {
      const child = makeChild('child-1');
      const flexChild = { ...child, layoutItemHSizing: 'fill' as const };
      const objects: Record<string, Shape> = { 'child-1': flexChild };
      const html = renderFrame(
        makeFrame({ layoutType: 'flex', layoutFlexDir: 'row' }),
        [flexChild],
        objects,
        ctx,
      );
      expect(html).toContain('flex-1');
    });

    it('does not apply absolutePositionClasses to flex children', () => {
      const child = makeChild('child-1');
      const objects: Record<string, Shape> = { 'child-1': child };
      const html = renderFrame(
        makeFrame({ layoutType: 'flex', layoutFlexDir: 'row' }),
        [child],
        objects,
        ctx,
      );
      // The child rendered inside flex should NOT have absolute left-[10px] top-[10px]
      expect(html).not.toContain('left-[10px]');
      expect(html).not.toContain('top-[10px]');
    });

    it('column flex: fill hSizing child uses explicit w-[Npx] on wrapper and child (not w-full)', () => {
      // Regression: w-full (percentage) on a cross-axis fill child in a column
      // container allows descendant overflow to inflate the container width.
      // Explicit px prevents the browser from expanding the container.
      const child: Shape = {
        ...makeChild('child-1'),
        width: 400,
        height: 100,
        layoutItemHSizing: 'fill' as const,
        layoutItemVSizing: 'fix' as const,
      };
      const objects: Record<string, Shape> = { 'child-1': child };
      const html = renderFrame(
        makeFrame({
          parentId: 'parent-frame' as Uuid,
          id: 'frame-1' as Uuid,
          layoutType: 'flex',
          layoutFlexDir: 'column',
        }),
        [child],
        objects,
        ctx,
      );
      // Wrapper div must use explicit pixel width
      expect(html).toContain('w-[400px]');
      expect(html).not.toContain('w-full');
    });
  });

  describe('grid layout mode', () => {
    it('emits grid class when layoutType is grid', () => {
      const html = renderFrame(makeFrame({ layoutType: 'grid' }), [], {}, ctx);
      expect(html).toContain('grid');
    });

    it('emits grid-cols-[...] class when layoutGridColumns is set', () => {
      const html = renderFrame(
        makeFrame({
          layoutType: 'grid',
          layoutGridColumns: [
            { type: 'fixed', value: 100 },
            { type: 'flex', value: 1 },
          ],
        }),
        [],
        {},
        ctx,
      );
      expect(html).toContain('grid-cols-[100px_1fr]');
    });

    it('emits grid-rows-[...] class when layoutGridRows is set', () => {
      const html = renderFrame(
        makeFrame({
          layoutType: 'grid',
          layoutGridRows: [{ type: 'fixed', value: 50 }],
        }),
        [],
        {},
        ctx,
      );
      expect(html).toContain('grid-rows-[50px]');
    });

    it('applies grid cell classes to children via cell lookup', () => {
      const child = makeChild('child-1');
      const objects: Record<string, Shape> = { 'child-1': child };
      const html = renderFrame(
        makeFrame({
          layoutType: 'grid',
          layoutGridCells: {
            'cell-1': {
              id: 'cell-1' as Uuid,
              row: 2,
              rowSpan: 1,
              column: 3,
              columnSpan: 1,
              shapes: ['child-1' as Uuid],
            },
          },
        }),
        [child],
        objects,
        ctx,
      );
      expect(html).toContain('row-start-[2]');
      expect(html).toContain('col-start-[3]');
    });

    it('does not apply absolute positioning to grid children', () => {
      const child = makeChild('child-1');
      const objects: Record<string, Shape> = { 'child-1': child };
      const html = renderFrame(
        makeFrame({ layoutType: 'grid' }),
        [child],
        objects,
        ctx,
      );
      expect(html).not.toContain('left-[10px]');
      expect(html).not.toContain('top-[10px]');
    });
  });

  describe('plain frame inside a flex/grid parent', () => {
    const layoutCtx: ConverterContext = {
      ...ctx,
      _parentIsLayout: true,
    };

    it('gets relative class so its absolutely-positioned children have a containing block', () => {
      // When a plain frame is a flex/grid child, positionClasses is `w-full h-full`
      // (no CSS position property). Without `relative`, the frame is position:static
      // and cannot act as a containing block for absolutely-positioned children.
      const frame = makeFrame({
        parentId: 'parent-frame' as Uuid,
        id: 'frame-1' as Uuid,
      });
      const child = makeChild('child-1');
      const objects: Record<string, Shape> = { 'child-1': child };
      const html = renderFrame(frame, [child], objects, layoutCtx);

      expect(html).toContain('relative');
    });

    it('children of a plain frame inside flex parent use absolute positioning, not w-full h-full', () => {
      // The plain frame must reset _parentIsLayout so its own children get
      // absolute top/left coordinates, not the flex-fill `w-full h-full`.
      const frame = makeFrame({
        parentId: 'parent-frame' as Uuid,
        id: 'frame-1' as Uuid,
        x: 0,
        y: 0,
      });
      const child = makeChild('child-1'); // x:10, y:10
      const objects: Record<string, Shape> = { 'child-1': child };
      const html = renderFrame(frame, [child], objects, layoutCtx);

      // Child must be absolutely positioned relative to the plain frame
      expect(html).toContain('left-[10px]');
      expect(html).toContain('top-[10px]');
      // The child div itself must NOT have w-full or h-full (only the frame wrapper may)
      const childMatch = html.match(/data-id="child-1"[^>]*class="([^"]+)"/);
      expect(childMatch?.[1]).not.toContain('w-full');
      expect(childMatch?.[1]).not.toContain('h-full');
    });
  });
});
