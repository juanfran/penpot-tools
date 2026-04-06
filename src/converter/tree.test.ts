import { describe, it, expect } from 'vitest';
import { buildTree, getChildren } from './tree';
import type { FrameShape, GroupShape, RectShape } from '../penpot.types';
import type { Uuid } from '../penpot.types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFrame(id: string, parentId: string, shapes: string[]): FrameShape {
  const uid = id as Uuid;
  return {
    id: uid,
    name: id,
    type: 'frame',
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    shapes: shapes as Uuid[],
    parentId: parentId as Uuid,
    frameId: uid,
    selrect: { x: 0, y: 0, width: 800, height: 600 },
    points: [],
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  };
}

function makeGroup(id: string, parentId: string, shapes: string[]): GroupShape {
  return {
    id: id as Uuid,
    name: id,
    type: 'group',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    shapes: shapes as Uuid[],
    parentId: parentId as Uuid,
    frameId: parentId as Uuid,
    selrect: { x: 0, y: 0, width: 100, height: 100 },
    points: [],
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  };
}

function makeRect(id: string, parentId: string): RectShape {
  return {
    id: id as Uuid,
    name: id,
    type: 'rect',
    x: 10,
    y: 10,
    width: 50,
    height: 50,
    parentId: parentId as Uuid,
    frameId: parentId as Uuid,
    selrect: { x: 10, y: 10, width: 50, height: 50 },
    points: [],
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  };
}

// ── getChildren ───────────────────────────────────────────────────────────────

describe('getChildren', () => {
  it('returns children of a frame in shapes-array order', () => {
    const rect1 = makeRect('r1', 'frame-root');
    const rect2 = makeRect('r2', 'frame-root');
    const root = makeFrame('frame-root', 'frame-root', ['r1', 'r2']);
    const objects = { 'frame-root': root, r1: rect1, r2: rect2 };

    const children = getChildren(root, objects);

    expect(children).toHaveLength(2);
    expect(children[0].id).toBe('r1');
    expect(children[1].id).toBe('r2');
  });

  it('returns empty array for a leaf shape (no shapes field)', () => {
    const rect = makeRect('r1', 'frame-root');
    const objects = { r1: rect };

    expect(getChildren(rect, objects)).toEqual([]);
  });

  it('skips IDs not present in objects', () => {
    const root = makeFrame('frame-root', 'frame-root', ['r1', 'missing']);
    const rect = makeRect('r1', 'frame-root');
    const objects = { 'frame-root': root, r1: rect };

    const children = getChildren(root, objects);

    expect(children).toHaveLength(1);
    expect(children[0].id).toBe('r1');
  });

  it('returns children of a group', () => {
    const rect = makeRect('r1', 'group-1');
    const group = makeGroup('group-1', 'frame-root', ['r1']);
    const objects = { 'group-1': group, r1: rect };

    const children = getChildren(group, objects);

    expect(children).toHaveLength(1);
    expect(children[0].id).toBe('r1');
  });
});

// ── buildTree ────────────────────────────────────────────────────────────────

describe('buildTree', () => {
  it('throws when no root shape is found', () => {
    const rect = makeRect('r1', 'other');
    expect(() => buildTree({ r1: rect })).toThrow('No root shape found');
  });

  it('returns root shape for a single-node tree', () => {
    const root = makeFrame('root', 'root', []);
    const tree = buildTree({ root });

    expect(tree.id).toBe('root');
    expect(tree._children).toEqual([]);
  });

  it('attaches direct children to the root', () => {
    const root = makeFrame('root', 'root', ['r1', 'r2']);
    const r1 = makeRect('r1', 'root');
    const r2 = makeRect('r2', 'root');
    const objects = { root, r1, r2 };

    const tree = buildTree(objects);

    expect(tree._children).toHaveLength(2);
    expect(tree._children[0].id).toBe('r1');
    expect(tree._children[1].id).toBe('r2');
  });

  it('preserves z-order from the shapes array', () => {
    const root = makeFrame('root', 'root', ['r2', 'r1']); // r2 first
    const r1 = makeRect('r1', 'root');
    const r2 = makeRect('r2', 'root');
    const objects = { root, r1, r2 };

    const tree = buildTree(objects);

    expect(tree._children[0].id).toBe('r2');
    expect(tree._children[1].id).toBe('r1');
  });

  it('builds a nested tree recursively', () => {
    const root = makeFrame('root', 'root', ['group-1']);
    const group = makeGroup('group-1', 'root', ['r1']);
    const r1 = makeRect('r1', 'group-1');
    const objects = { root, 'group-1': group, r1 };

    const tree = buildTree(objects);

    expect(tree._children).toHaveLength(1);
    const groupNode = tree._children[0];
    expect(groupNode.id).toBe('group-1');
    expect(groupNode._children).toHaveLength(1);
    expect(groupNode._children[0].id).toBe('r1');
    expect(groupNode._children[0]._children).toEqual([]);
  });

  it('does not mutate the original objects', () => {
    const root = makeFrame('root', 'root', ['r1']);
    const r1 = makeRect('r1', 'root');
    const objects = { root, r1 };
    const originalRoot = { ...root };

    buildTree(objects);

    expect(objects.root).toEqual(originalRoot);
    expect('_children' in objects.root).toBe(false);
  });

  it('returns a new object (not the same reference) for the root', () => {
    const root = makeFrame('root', 'root', []);
    const objects = { root };

    const tree = buildTree(objects);

    expect(tree).not.toBe(root);
  });
});
