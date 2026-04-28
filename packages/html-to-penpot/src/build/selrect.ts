import type { GeomMatrix, GeomPoint, GeomRect } from '@penpot-tools/converter/types';

const IDENTITY: GeomMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export function identityMatrix(): GeomMatrix {
  return { ...IDENTITY };
}

/**
 * Build the `selrect` + `points` Penpot expects from a measured AABB. We don't
 * support rotation in v1, so points are just the four AABB corners and the
 * transform is identity.
 */
export function buildSelrect(rect: { x: number; y: number; width: number; height: number }): {
  selrect: GeomRect & { x1: number; y1: number; x2: number; y2: number };
  points: [GeomPoint, GeomPoint, GeomPoint, GeomPoint];
} {
  const x = rect.x;
  const y = rect.y;
  const w = Math.max(0, rect.width);
  const h = Math.max(0, rect.height);
  return {
    selrect: { x, y, width: w, height: h, x1: x, y1: y, x2: x + w, y2: y + h },
    points: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
  };
}
