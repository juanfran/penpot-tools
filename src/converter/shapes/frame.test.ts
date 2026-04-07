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
  });

  describe('grid layout mode', () => {
    it('emits grid class when layoutType is grid', () => {
      const html = renderFrame(makeFrame({ layoutType: 'grid' }), [], {}, ctx);
      expect(html).toContain('grid');
    });

    it('emits grid-template-columns style when layoutGridColumns is set', () => {
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
      expect(html).toContain('grid-template-columns: 100px 1fr');
    });

    it('emits grid-template-rows style when layoutGridRows is set', () => {
      const html = renderFrame(
        makeFrame({
          layoutType: 'grid',
          layoutGridRows: [{ type: 'fixed', value: 50 }],
        }),
        [],
        {},
        ctx,
      );
      expect(html).toContain('grid-template-rows: 50px');
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
});
