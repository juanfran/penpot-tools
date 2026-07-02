import { describe, expect, it } from 'vitest';
import type { ShapeTreeNode } from '#/lib/server/penpot-api';

import { deepestAt, topChildAt } from './tree-utils';

function node(
  id: string,
  x = 0,
  y = 0,
  width = 100,
  height = 100,
  children: ShapeTreeNode[] = [],
  extra: Partial<ShapeTreeNode> = {},
): ShapeTreeNode {
  return {
    id,
    name: id,
    type: 'rect',
    x,
    y,
    width,
    height,
    children,
    ...extra,
  };
}

describe('topChildAt', () => {
  it('returns the later sibling for a plain parent when siblings overlap', () => {
    const back = node('back');
    const front = node('front');

    expect(topChildAt([back, front], 50, 50)?.id).toBe('front');
  });

  it('prefers a higher layout item z-index over sibling order', () => {
    const later = node('later', 0, 0, 100, 100, [], { layoutItemZIndex: 1 });
    const raised = node('raised', 0, 0, 100, 100, [], { layoutItemZIndex: 2 });

    expect(topChildAt([raised, later], 50, 50)?.id).toBe('raised');
  });

  it('matches converter paint order for flex row parents with equal z-index children', () => {
    const modal = node('modal', 25, 25, 50, 50, [], { layoutItemZIndex: 10 });
    const overlay = node('overlay', 0, 0, 100, 100, [], { layoutItemZIndex: 10 });
    const parent = node('parent', 0, 0, 100, 100, [modal, overlay], {
      type: 'frame',
      layout: 'flex',
      layoutFlexDir: 'row',
    });

    expect(topChildAt(parent.children, 50, 50, parent)?.id).toBe('modal');
  });

  it('does not invert row-reverse flex parents', () => {
    const first = node('first');
    const second = node('second');
    const parent = node('parent', 0, 0, 100, 100, [first, second], {
      type: 'frame',
      layout: 'flex',
      layoutFlexDir: 'row-reverse',
    });

    expect(topChildAt(parent.children, 50, 50, parent)?.id).toBe('second');
  });
});

describe('deepestAt', () => {
  it('descends through the top painted flex child instead of a covering sibling', () => {
    const modalContent = node('modal-content', 40, 40, 20, 20);
    const modal = node('modal', 25, 25, 50, 50, [modalContent], { layoutItemZIndex: 10 });
    const overlay = node('overlay', 0, 0, 100, 100, [], { layoutItemZIndex: 10 });
    const parent = node('parent', 0, 0, 100, 100, [modal, overlay], {
      type: 'frame',
      layout: 'flex',
      layoutFlexDir: 'row',
    });

    expect(deepestAt([parent], 50, 50)?.id).toBe('modal-content');
  });
});
