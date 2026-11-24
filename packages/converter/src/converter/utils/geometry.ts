import type { ShapeCommon } from '../../penpot.types';

export interface ShapeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Position and size of a shape in page coordinates.
 *
 * Path and bool shapes keep their geometry in `selrect`: Penpot sends their
 * `x`/`y`/`width`/`height` as `null`, or leaves them stale when the shape is
 * moved (only `content`, `selrect` and `points` follow the move), so for
 * those types `selrect` wins. Other shapes use their own fields and fall back
 * to `selrect` field by field. Reading the nulls as 0 placed a shape at minus
 * its page position.
 */
export function shapeBox(
  shape: Pick<ShapeCommon, 'x' | 'y' | 'width' | 'height'> & {
    selrect?: ShapeCommon['selrect'];
    type?: ShapeCommon['type'];
  },
): ShapeBox {
  const r = shape.selrect;
  if (r && (shape.type === 'path' || shape.type === 'bool')) {
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }
  return {
    x: shape.x ?? shape.selrect?.x ?? 0,
    y: shape.y ?? shape.selrect?.y ?? 0,
    width: shape.width ?? shape.selrect?.width ?? 0,
    height: shape.height ?? shape.selrect?.height ?? 0,
  };
}
