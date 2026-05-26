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

// Returns the topmost (last in array = visually on top) child that contains (x, y)
export function topChildAt(children: ShapeTreeNode[], x: number, y: number): ShapeTreeNode | null {
  let result: ShapeTreeNode | null = null;
  for (const child of children) {
    if (hitTest(child, x, y)) result = child;
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
export function deepestAt(nodes: ShapeTreeNode[], x: number, y: number): ShapeTreeNode | null {
  let result: ShapeTreeNode | null = null;
  for (const node of nodes) {
    if (hitTest(node, x, y)) {
      result = node;
      const deeper = deepestAt(node.children, x, y);
      if (deeper) result = deeper;
    }
  }
  return result;
}
