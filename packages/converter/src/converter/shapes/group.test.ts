import { describe, it, expect } from 'vitest';
import { renderGroup } from './group';
import type { GroupShape, Shape, Uuid, HexColor } from '../../penpot.types';
import type { ConverterContext } from '../types';

const ctx: ConverterContext = {
  resolveImageUrl: (id) => `https://assets.example.com/${id}`,
};

const makeGroup = (overrides: Partial<GroupShape> = {}): GroupShape => ({
  id: 'group-1' as Uuid,
  name: 'Group',
  type: 'group',
  x: 10,
  y: 20,
  width: 200,
  height: 100,
  shapes: [],
  selrect: { x: 10, y: 20, width: 200, height: 100 },
  points: [],
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  parentId: 'parent-1' as Uuid,
  frameId: 'frame-1' as Uuid,
  ...overrides,
});

const makeRect = (id: string): Shape => ({
  id: id as Uuid,
  name: 'Rect',
  type: 'rect',
  x: 0,
  y: 0,
  width: 50,
  height: 50,
  selrect: { x: 0, y: 0, width: 50, height: 50 },
  points: [],
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  parentId: 'group-1' as Uuid,
  frameId: 'frame-1' as Uuid,
  fills: [{ fillColor: '#ff0000' as HexColor }],
});

describe('renderGroup', () => {
  it('renders a div element', () => {
    const html = renderGroup(makeGroup(), [], {}, ctx);
    expect(html).toMatch(/^<div/);
    expect(html).toMatch(/<\/div>$/);
  });

  it('includes data-id attribute', () => {
    const html = renderGroup(makeGroup({ id: 'my-group' as Uuid }), [], {}, ctx);
    expect(html).toContain('data-id="my-group"');
  });

  it('includes data-type attribute', () => {
    expect(renderGroup(makeGroup(), [], {}, ctx)).toContain('data-type="group"');
  });

  it('positions absolutely using style', () => {
    const html = renderGroup(makeGroup({ x: 10, y: 20, width: 200, height: 100 }), [], {}, ctx);
    expect(html).toContain('position: absolute;');
    expect(html).toContain('left: 10px;');
    expect(html).toContain('top: 20px;');
    expect(html).toContain('width: 200px;');
    expect(html).toContain('height: 100px;');
  });

  it('renders children inside the group', () => {
    const child = makeRect('child-1');
    const objects: Record<string, Shape> = { 'child-1': child };
    const html = renderGroup(makeGroup(), [child], objects, ctx);
    expect(html).toContain('data-id="child-1"');
  });

  it('renders multiple children', () => {
    const child1 = makeRect('child-1');
    const child2 = makeRect('child-2');
    const objects: Record<string, Shape> = {
      'child-1': child1,
      'child-2': child2,
    };
    const html = renderGroup(makeGroup(), [child1, child2], objects, ctx);
    expect(html).toContain('data-id="child-1"');
    expect(html).toContain('data-id="child-2"');
  });

  it('includes opacity style', () => {
    expect(renderGroup(makeGroup({ opacity: 0.5 }), [], {}, ctx)).toContain('opacity: 0.5;');
  });

  it('includes blend mode style', () => {
    expect(renderGroup(makeGroup({ blendMode: 'multiply' }), [], {}, ctx)).toContain(
      'mix-blend-mode: multiply;',
    );
  });

  it('includes display: none when hidden', () => {
    expect(renderGroup(makeGroup({ hidden: true }), [], {}, ctx)).toContain('display: none;');
  });

  it('adds overflow: hidden for masked groups', () => {
    expect(renderGroup(makeGroup({ maskedGroup: true }), [], {}, ctx)).toContain(
      'overflow: hidden;',
    );
  });

  it('has no class attribute', () => {
    expect(renderGroup(makeGroup(), [], {}, ctx)).not.toContain('class=');
  });

  it('adds position: relative when it is a flex/grid child with children (containing block for absolute kids)', () => {
    const child = makeRect('child-1');
    const objects: Record<string, Shape> = { 'child-1': child };
    const flexCtx: ConverterContext = {
      ...ctx,
      _parentIsLayout: true,
      _parentLayoutItemStyles: 'width: 70px; height: 50px;',
    };
    const html = renderGroup(makeGroup(), [child], objects, flexCtx);
    expect(html).toContain('position: relative;');
    // The group's own style must not include position: absolute; the group is a layout item.
    const outerOpen = html.match(/^<div [^>]*data-id="group-1"[^>]*>/)?.[0] ?? '';
    expect(outerOpen).not.toContain('position: absolute');
  });

  // See frame.test.ts → "skips CSS transform on flipped / matrix-transformed
  // frames" for the original regression. Groups follow the same model:
  // children sit at post-transform world coordinates, so applying the group's
  // own matrix on top would double the transformation.
  it('skips `transform: matrix(...)` for a group with flipY transform (no double-flip)', () => {
    const flipYMatrix = { a: 1, b: 0, c: 0, d: -1, e: 0, f: 0 };
    const html = renderGroup(
      makeGroup({
        flipY: true,
        transform: flipYMatrix,
        transformInverse: flipYMatrix,
      }),
      [],
      {},
      ctx,
    );
    expect(html).not.toMatch(/transform:\s*matrix\(/);
  });

  it('does not add position: relative when it is a flex child with no children', () => {
    const flexCtx: ConverterContext = {
      ...ctx,
      _parentIsLayout: true,
      _parentLayoutItemStyles: 'width: 70px; height: 50px;',
    };
    const html = renderGroup(makeGroup({ shapes: [] }), [], {}, flexCtx);
    expect(html).not.toContain('position: relative');
  });
});
