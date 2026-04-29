import type { GeomMatrix, GeomPoint, GeomRect } from '@penpot-tools/converter/types';

const IDENTITY: GeomMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export function identityMatrix(): GeomMatrix {
  return { ...IDENTITY };
}

/**
 * Build the `selrect` + `points` Penpot expects from a measured AABB plus an
 * optional rotation in degrees (Penpot convention — the renderer emits CSS
 * `rotate(-rotation deg)`). `selrect` is always the unrotated AABB; `points`
 * are the four corners rotated around the rect's centre, which is how Penpot
 * stores hit-testing geometry.
 */
export function buildSelrect(
  rect: { x: number; y: number; width: number; height: number },
  rotationDeg = 0,
): {
  selrect: GeomRect & { x1: number; y1: number; x2: number; y2: number };
  points: [GeomPoint, GeomPoint, GeomPoint, GeomPoint];
} {
  const x = rect.x;
  const y = rect.y;
  const w = Math.max(0, rect.width);
  const h = Math.max(0, rect.height);

  const corners: [GeomPoint, GeomPoint, GeomPoint, GeomPoint] = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];

  if (rotationDeg === 0) {
    return {
      selrect: { x, y, width: w, height: h, x1: x, y1: y, x2: x + w, y2: y + h },
      points: corners,
    };
  }

  // Penpot stores rotation with the opposite sign of CSS — to recover the
  // CSS-equivalent angle for points rotation, negate again.
  const rad = (-rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rotate = (p: GeomPoint): GeomPoint => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  };
  return {
    selrect: { x, y, width: w, height: h, x1: x, y1: y, x2: x + w, y2: y + h },
    points: [rotate(corners[0]), rotate(corners[1]), rotate(corners[2]), rotate(corners[3])],
  };
}
