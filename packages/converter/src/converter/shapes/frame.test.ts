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
    const html = renderFrame(makeFrame({ id: 'my-frame' as Uuid }), [], {}, ctx);
    expect(html).toContain('data-id="my-frame"');
  });

  it('includes data-type attribute', () => {
    expect(renderFrame(makeFrame(), [], {}, ctx)).toContain('data-type="frame"');
  });

  it('root frame (parentId === id) uses position: relative', () => {
    const frame = makeFrame();
    const html = renderFrame(frame, [], {}, ctx);
    expect(html).toContain('position: relative;');
    expect(html).not.toContain('position: absolute;');
  });

  it('nested frame uses position: absolute', () => {
    const frame = makeFrame({ parentId: 'other-frame' as Uuid });
    const html = renderFrame(frame, [], {}, ctx);
    expect(html).toContain('position: absolute;');
  });

  it('includes width and height in style', () => {
    const html = renderFrame(makeFrame({ width: 400, height: 300 }), [], {}, ctx);
    expect(html).toContain('width: 400px;');
    expect(html).toContain('height: 300px;');
  });

  it('includes overflow: hidden when clipContent is true', () => {
    const html = renderFrame(makeFrame({ clipContent: true }), [], {}, ctx);
    expect(html).toContain('overflow: hidden;');
  });

  it('does not include overflow: hidden when clipContent is false', () => {
    const html = renderFrame(makeFrame({ clipContent: false }), [], {}, ctx);
    expect(html).not.toContain('overflow: hidden;');
  });

  it('does not include overflow: hidden when showContent is true', () => {
    const html = renderFrame(makeFrame({ showContent: true }), [], {}, ctx);
    expect(html).not.toContain('overflow: hidden;');
  });

  it('renders children inside', () => {
    const child = makeChild('child-1');
    const objects: Record<string, Shape> = { 'child-1': child };
    const html = renderFrame(makeFrame(), [child], objects, ctx);
    expect(html).toContain('data-id="child-1"');
  });

  it('applies fills as background-color', () => {
    const html = renderFrame(
      makeFrame({ fills: [{ fillColor: '#ffffff' as HexColor }] }),
      [],
      {},
      ctx,
    );
    expect(html).toContain('background-color: #ffffff;');
  });

  it('includes opacity style', () => {
    const html = renderFrame(makeFrame({ opacity: 0.5 }), [], {}, ctx);
    expect(html).toContain('opacity: 0.5;');
  });

  it('includes display: none when hidden', () => {
    const html = renderFrame(makeFrame({ hidden: true }), [], {}, ctx);
    expect(html).toContain('display: none;');
  });

  it('includes corner radius style', () => {
    const html = renderFrame(makeFrame({ r1: 8, r2: 8, r3: 8, r4: 8 }), [], {}, ctx);
    expect(html).toContain('border-radius: 8px;');
  });

  it('has no class attribute', () => {
    const html = renderFrame(makeFrame(), [], {}, ctx);
    expect(html).not.toContain('class=');
  });

  describe('flex layout mode', () => {
    it('emits display: flex when layoutType is flex', () => {
      const html = renderFrame(
        makeFrame({ layoutType: 'flex', layoutFlexDir: 'row' }),
        [],
        {},
        ctx,
      );
      expect(html).toContain('display: flex;');
    });

    it('emits flex-direction: column for column direction', () => {
      const html = renderFrame(
        makeFrame({ layoutType: 'flex', layoutFlexDir: 'column' }),
        [],
        {},
        ctx,
      );
      expect(html).toContain('flex-direction: column;');
    });

    it('emits gap style when layoutRowGap and layoutColumnGap are equal', () => {
      const html = renderFrame(
        makeFrame({ layoutType: 'flex', layoutRowGap: 10, layoutColumnGap: 10 }),
        [],
        {},
        ctx,
      );
      expect(html).toContain('gap: 10px;');
    });

    it('emits flex: 1 for fill HSizing child in row parent', () => {
      const child = makeChild('child-1');
      const flexChild = { ...child, layoutItemHSizing: 'fill' as const };
      const objects: Record<string, Shape> = { 'child-1': flexChild };
      const html = renderFrame(
        makeFrame({ layoutType: 'flex', layoutFlexDir: 'row' }),
        [flexChild],
        objects,
        ctx,
      );
      expect(html).toContain('flex: 1;');
    });

    it('does not apply absolute positioning to flex children', () => {
      const child = makeChild('child-1');
      const objects: Record<string, Shape> = { 'child-1': child };
      const html = renderFrame(
        makeFrame({ layoutType: 'flex', layoutFlexDir: 'row' }),
        [child],
        objects,
        ctx,
      );
      expect(html).not.toContain('left: 10px;');
      expect(html).not.toContain('top: 10px;');
    });

    it('column flex: fill hSizing child uses explicit width in px (not 100%)', () => {
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
      expect(html).toContain('width: 400px;');
      expect(html).not.toContain('width: 100%;');
    });
  });

  describe('grid layout mode', () => {
    it('emits display: grid when layoutType is grid', () => {
      const html = renderFrame(makeFrame({ layoutType: 'grid' }), [], {}, ctx);
      expect(html).toContain('display: grid;');
    });

    it('emits grid-template-columns when layoutGridColumns is set', () => {
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
      expect(html).toContain('grid-template-columns: 100px 1fr;');
    });

    it('emits grid-template-rows when layoutGridRows is set', () => {
      const html = renderFrame(
        makeFrame({ layoutType: 'grid', layoutGridRows: [{ type: 'fixed', value: 50 }] }),
        [],
        {},
        ctx,
      );
      expect(html).toContain('grid-template-rows: 50px;');
    });

    it('applies grid cell styles to children via cell lookup', () => {
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
      expect(html).toContain('grid-row-start: 2;');
      expect(html).toContain('grid-column-start: 3;');
    });

    it('does not apply absolute positioning to grid children', () => {
      const child = makeChild('child-1');
      const objects: Record<string, Shape> = { 'child-1': child };
      const html = renderFrame(makeFrame({ layoutType: 'grid' }), [child], objects, ctx);
      expect(html).not.toContain('left: 10px;');
      expect(html).not.toContain('top: 10px;');
    });
  });

  describe('plain frame inside a flex/grid parent', () => {
    const layoutCtx: ConverterContext = { ...ctx, _parentIsLayout: true };

    it('gets position: relative so its absolutely-positioned children have a containing block', () => {
      const frame = makeFrame({ parentId: 'parent-frame' as Uuid, id: 'frame-1' as Uuid });
      const child = makeChild('child-1');
      const objects: Record<string, Shape> = { 'child-1': child };
      const html = renderFrame(frame, [child], objects, layoutCtx);
      expect(html).toContain('position: relative;');
    });

    it('children of a plain frame inside flex parent use absolute positioning', () => {
      const frame = makeFrame({
        parentId: 'parent-frame' as Uuid,
        id: 'frame-1' as Uuid,
        x: 0,
        y: 0,
      });
      const child = makeChild('child-1'); // x:10, y:10
      const objects: Record<string, Shape> = { 'child-1': child };
      const html = renderFrame(frame, [child], objects, layoutCtx);
      expect(html).toContain('left: 10px;');
      expect(html).toContain('top: 10px;');
    });
  });

  describe('layoutItemAbsolute flex child', () => {
    it('does not override its own position: absolute with position: relative', () => {
      const frame = makeFrame({
        parentId: 'parent-frame' as Uuid,
        id: 'frame-1' as Uuid,
        layoutItemAbsolute: true,
      });
      const absoluteCtx: ConverterContext = {
        ...ctx,
        _parentIsLayout: true,
        _parentIsLayoutAutoW: true,
        _parentIsLayoutAutoH: true,
        _parentLayoutItemStyles: 'position: absolute; left: 464px; top: 157.5px;',
      };
      const html = renderFrame(frame, [], {}, absoluteCtx);
      expect(html).toContain('position: absolute;');
      expect(html).not.toContain('position: relative;');
    });

    it('keeps position: absolute when it is a flex frame with absolute children', () => {
      // Reproduces a bug where a layoutItemAbsolute flex frame with absolute children
      // got `position: relative` appended after `position: absolute`, causing CSS to
      // use relative (last wins) and placing the frame in flex flow instead of at its
      // own left/top coordinates.
      const frame = makeFrame({
        parentId: 'parent-frame' as Uuid,
        id: 'frame-1' as Uuid,
        layoutType: 'flex',
        layoutFlexDir: 'row',
        layoutItemAbsolute: true,
      });
      const absoluteChild = { ...makeChild('abs-child'), layoutItemAbsolute: true };
      const objects: Record<string, Shape> = { 'abs-child': absoluteChild };
      const absoluteCtx: ConverterContext = {
        ...ctx,
        _parentIsLayout: true,
        _parentIsLayoutAutoW: true,
        _parentIsLayoutAutoH: true,
        _parentLayoutItemStyles: 'position: absolute; left: 464px; top: 157.5px;',
      };
      const html = renderFrame(frame, [absoluteChild], objects, absoluteCtx);
      expect(html).toContain('position: absolute;');
      expect(html).not.toContain('position: relative;');
    });

    it('keeps position: absolute when it is a plain frame with children', () => {
      const frame = makeFrame({
        parentId: 'parent-frame' as Uuid,
        id: 'frame-1' as Uuid,
        layoutItemAbsolute: true,
      });
      const child = makeChild('child-1');
      const objects: Record<string, Shape> = { 'child-1': child };
      const absoluteCtx: ConverterContext = {
        ...ctx,
        _parentIsLayout: true,
        _parentIsLayoutAutoW: true,
        _parentIsLayoutAutoH: true,
        _parentLayoutItemStyles: 'position: absolute; left: 50px; top: 80px;',
      };
      const html = renderFrame(frame, [child], objects, absoluteCtx);
      expect(html).toContain('position: absolute;');
      expect(html).not.toContain('position: relative;');
    });
  });

  describe('shadow border-radius propagation', () => {
    const makeRoundedRect = (overrides: Partial<Shape> = {}): Shape =>
      ({
        ...makeChild('rect-1'),
        width: 400,
        height: 300,
        r1: 28,
        r2: 28,
        r3: 28,
        r4: 28,
        ...overrides,
      }) as Shape;

    it('propagates a filling rect child radius to a shadowed transparent frame', () => {
      const frame = makeFrame({
        parentId: 'parent-1' as Uuid,
        shadow: [
          {
            id: null,
            color: { color: '#000000' as HexColor, opacity: 0.2 },
            offsetX: 0,
            offsetY: 4,
            blur: 8,
            spread: 0,
            style: 'drop-shadow',
            hidden: false,
          },
        ],
      });
      const rect = makeRoundedRect();
      const html = renderFrame(frame, [rect], { 'rect-1': rect }, ctx);
      const frameOpen = html.match(/^<div [^>]*data-id="frame-1"[^>]*>/)?.[0] ?? '';
      expect(frameOpen).toContain('border-radius: 28px;');
      expect(frameOpen).toContain('box-shadow:');
    });

    it('does not propagate when the frame already has its own border-radius', () => {
      const frame = makeFrame({
        parentId: 'parent-1' as Uuid,
        r1: 8,
        r2: 8,
        r3: 8,
        r4: 8,
        shadow: [
          {
            id: null,
            color: { color: '#000000' as HexColor, opacity: 0.2 },
            offsetX: 0,
            offsetY: 4,
            blur: 8,
            spread: 0,
            style: 'drop-shadow',
            hidden: false,
          },
        ],
      });
      const rect = makeRoundedRect();
      const html = renderFrame(frame, [rect], { 'rect-1': rect }, ctx);
      const frameOpen = html.match(/^<div [^>]*data-id="frame-1"[^>]*>/)?.[0] ?? '';
      expect(frameOpen).toContain('border-radius: 8px;');
      expect(frameOpen).not.toContain('border-radius: 28px;');
    });

    it('does not propagate when the frame has its own fill', () => {
      const frame = makeFrame({
        parentId: 'parent-1' as Uuid,
        fills: [{ fillColor: '#ffffff' as HexColor }],
        shadow: [
          {
            id: null,
            color: { color: '#000000' as HexColor, opacity: 0.2 },
            offsetX: 0,
            offsetY: 4,
            blur: 8,
            spread: 0,
            style: 'drop-shadow',
            hidden: false,
          },
        ],
      });
      const rect = makeRoundedRect();
      const html = renderFrame(frame, [rect], { 'rect-1': rect }, ctx);
      const frameOpen = html.match(/^<div [^>]*data-id="frame-1"[^>]*>/)?.[0] ?? '';
      expect(frameOpen).not.toContain('border-radius: 28px;');
    });

    it('skips hidden rect children when looking for a radius to propagate', () => {
      const frame = makeFrame({
        parentId: 'parent-1' as Uuid,
        shadow: [
          {
            id: null,
            color: { color: '#000000' as HexColor, opacity: 0.2 },
            offsetX: 0,
            offsetY: 4,
            blur: 8,
            spread: 0,
            style: 'drop-shadow',
            hidden: false,
          },
        ],
      });
      const hiddenRect = makeRoundedRect({ id: 'rect-hidden' as Uuid, hidden: true, r1: 28 });
      const html = renderFrame(frame, [hiddenRect], { 'rect-hidden': hiddenRect }, ctx);
      const frameOpen = html.match(/^<div [^>]*data-id="frame-1"[^>]*>/)?.[0] ?? '';
      expect(frameOpen).not.toContain('border-radius: 28px;');
    });
  });
});
