export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type GapLineKey = 'hgap' | 'vgap' | 'hleft' | 'hright' | 'vtop' | 'vbot';

export interface GapLineSpec {
  key: GapLineKey;
  orientation: 'h' | 'v';
  start: number;
  end: number;
  cross: number;
}

const EPS = 0.5;

/**
 * Given two rects (selected and hovered shape bounds, in canvas coords),
 * returns the set of lines to draw visualizing the distance between them.
 *
 * - Sibling relationship (ranges disjoint on at least one axis):
 *   one gap line per separated axis, placed between the shapes.
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

  const lines: GapLineSpec[] = [];

  if (xDisjoint || yDisjoint) {
    if (xDisjoint) {
      const aLeftOfB = aRight < b.x;
      lines.push({
        key: 'hgap',
        orientation: 'h',
        start: aLeftOfB ? aRight : bRight,
        end: aLeftOfB ? b.x : a.x,
        cross: (a.y + a.height / 2 + b.y + b.height / 2) / 2,
      });
    }
    if (yDisjoint) {
      const aAboveB = aBottom < b.y;
      lines.push({
        key: 'vgap',
        orientation: 'v',
        start: aAboveB ? aBottom : bBottom,
        end: aAboveB ? b.y : a.y,
        cross: (a.x + a.width / 2 + b.x + b.width / 2) / 2,
      });
    }
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
