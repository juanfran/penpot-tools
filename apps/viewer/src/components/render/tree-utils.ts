import type { ShapeTreeNode } from '#/lib/server/penpot-api';

export function findNodeById(nodes: ShapeTreeNode[], id: string): ShapeTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNodeById(node.children, id);
    if (found) return found;
  }
  return null;
}

export function findFirstBoard(nodes: ShapeTreeNode[]): ShapeTreeNode | null {
  for (const node of nodes) {
    if (node.type === 'frame') return node;
  }
  for (const node of nodes) {
    const found = findFirstBoard(node.children);
    if (found) return found;
  }
  return null;
}

export function hitTest(node: ShapeTreeNode, x: number, y: number): boolean {
  return x >= node.x && x <= node.x + node.width && y >= node.y && y <= node.y + node.height;
}

function isFlexParent(parent: ShapeTreeNode | undefined): boolean {
  return parent?.type === 'frame' && (parent.layoutType === 'flex' || parent.layout === 'flex');
}

function usesReversedRenderOrder(parent: ShapeTreeNode | undefined): boolean {
  if (!isFlexParent(parent)) return false;
  const flexDir = parent?.layoutFlexDir;
  return flexDir !== 'row-reverse' && flexDir !== 'column-reverse';
}

function renderOrderIndex(
  parent: ShapeTreeNode | undefined,
  index: number,
  siblingCount: number,
): number {
  return usesReversedRenderOrder(parent) ? siblingCount - 1 - index : index;
}

function isPaintedAbove(
  current: ShapeTreeNode,
  currentIndex: number,
  best: ShapeTreeNode,
  bestIndex: number,
  siblingCount: number,
  parent: ShapeTreeNode | undefined,
): boolean {
  const currentZ = current.layoutItemZIndex ?? 0;
  const bestZ = best.layoutItemZIndex ?? 0;
  if (currentZ !== bestZ) return currentZ > bestZ;

  return (
    renderOrderIndex(parent, currentIndex, siblingCount) >
    renderOrderIndex(parent, bestIndex, siblingCount)
  );
}

// Returns the topmost child that contains (x, y), using the same sibling paint
// order as the converter's rendered DOM.
export function topChildAt(
  children: ShapeTreeNode[],
  x: number,
  y: number,
  parent?: ShapeTreeNode,
): ShapeTreeNode | null {
  let result: ShapeTreeNode | null = null;
  let resultIndex = -1;
  for (let index = 0; index < children.length; index++) {
    const child = children[index];
    if (!hitTest(child, x, y)) continue;
    if (
      !result ||
      isPaintedAbove(child, index, result, resultIndex, children.length, parent)
    ) {
      result = child;
      resultIndex = index;
    }
  }
  return result;
}

export function findParent(nodes: ShapeTreeNode[], targetId: string): ShapeTreeNode | null {
  for (const node of nodes) {
    if (node.children.some((c) => c.id === targetId)) return node;
    const found = findParent(node.children, targetId);
    if (found) return found;
  }
  return null;
}

// Returns the deepest node that contains (x, y), preferring topmost siblings
export function deepestAt(
  nodes: ShapeTreeNode[],
  x: number,
  y: number,
  parent?: ShapeTreeNode,
): ShapeTreeNode | null {
  const node = topChildAt(nodes, x, y, parent);
  if (!node) return null;
  return deepestAt(node.children, x, y, node) ?? node;
}
