export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type GapLineKey =
  | 'hgap'
  | 'vgap'
  | 'hleft'
  | 'hright'
  | 'vtop'
  | 'vbot'
  | 'hproj'
  | 'vproj';

export interface GapLineSpec {
  key: GapLineKey;
  orientation: 'h' | 'v';
  start: number;
  end: number;
  cross: number;
  /** Projection guide — drawn without a distance label. */
  noLabel?: boolean;
}

const EPS = 0.5;

/**
 * Given two rects (selected = a, hovered = b, in canvas coords),
 * returns the set of lines to draw visualizing the distance between them.
 *
 * - Both axes disjoint (diagonally separated):
 *   two measurement lines anchored to the selected shape's near corner
 *   plus two projection guides to the hovered shape's near corner.
 * - Single axis disjoint (sibling):
 *   one gap line per separated axis, placed inside the overlap on the other axis.
 * - Parent/child or intersecting (both axes overlap):
 *   up to four edge-to-edge inset lines (left, right, top, bottom),
 *   only drawn where the edges differ.
 */
export function computeDistanceLines(a: Rect, b: Rect): GapLineSpec[] {
  const aRight = a.x + a.width;
  const aBottom = a.y + a.height;
  const bRight = b.x + b.width;
  const bBottom = b.y + b.height;

  const xDisjoint = aRight < b.x - EPS || bRight < a.x - EPS;
  const yDisjoint = aBottom < b.y - EPS || bBottom < a.y - EPS;

  if (xDisjoint && yDisjoint) {
    const aLeftOfB = aRight < b.x;
    const aAboveB = aBottom < b.y;
    const aNearX = aLeftOfB ? aRight : a.x;
    const aNearY = aAboveB ? aBottom : a.y;
    const bNearX = aLeftOfB ? b.x : bRight;
    const bNearY = aAboveB ? b.y : bBottom;
    const minX = Math.min(aNearX, bNearX);
    const maxX = Math.max(aNearX, bNearX);
    const minY = Math.min(aNearY, bNearY);
    const maxY = Math.max(aNearY, bNearY);
    return [
      { key: 'hgap', orientation: 'h', start: minX, end: maxX, cross: aNearY },
      { key: 'vgap', orientation: 'v', start: minY, end: maxY, cross: aNearX },
      { key: 'hproj', orientation: 'h', start: minX, end: maxX, cross: bNearY, noLabel: true },
      { key: 'vproj', orientation: 'v', start: minY, end: maxY, cross: bNearX, noLabel: true },
    ];
  }

  const lines: GapLineSpec[] = [];

  if (xDisjoint) {
    const aLeftOfB = aRight < b.x;
    lines.push({
      key: 'hgap',
      orientation: 'h',
      start: aLeftOfB ? aRight : bRight,
      end: aLeftOfB ? b.x : a.x,
      cross: (Math.max(a.y, b.y) + Math.min(aBottom, bBottom)) / 2,
    });
    return lines;
  }
  if (yDisjoint) {
    const aAboveB = aBottom < b.y;
    lines.push({
      key: 'vgap',
      orientation: 'v',
      start: aAboveB ? aBottom : bBottom,
      end: aAboveB ? b.y : a.y,
      cross: (Math.max(a.x, b.x) + Math.min(aRight, bRight)) / 2,
    });
    return lines;
  }

  // Both axes overlap — inset distances on each side where edges differ.
  const yCross = (Math.max(a.y, b.y) + Math.min(aBottom, bBottom)) / 2;
  const xCross = (Math.max(a.x, b.x) + Math.min(aRight, bRight)) / 2;

  if (Math.abs(a.x - b.x) > EPS) {
    lines.push({
      key: 'hleft',
      orientation: 'h',
      start: Math.min(a.x, b.x),
      end: Math.max(a.x, b.x),
      cross: yCross,
    });
  }
  if (Math.abs(aRight - bRight) > EPS) {
    lines.push({
      key: 'hright',
      orientation: 'h',
      start: Math.min(aRight, bRight),
      end: Math.max(aRight, bRight),
      cross: yCross,
    });
  }
  if (Math.abs(a.y - b.y) > EPS) {
    lines.push({
      key: 'vtop',
      orientation: 'v',
      start: Math.min(a.y, b.y),
      end: Math.max(a.y, b.y),
      cross: xCross,
    });
  }
  if (Math.abs(aBottom - bBottom) > EPS) {
    lines.push({
      key: 'vbot',
      orientation: 'v',
      start: Math.min(aBottom, bBottom),
      end: Math.max(aBottom, bBottom),
      cross: xCross,
    });
  }

  return lines;
}
