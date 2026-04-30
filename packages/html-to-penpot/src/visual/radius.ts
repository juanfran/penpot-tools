import type { PickedComputedStyle } from '../types';
import { parseLengthOrPct } from '../build/css';

export interface RadiusValues {
  r1?: number;
  r2?: number;
  r3?: number;
  r4?: number;
}

export interface RadiusBase {
  /** Element's untransformed width — base for horizontal % radii. */
  width: number;
  /** Element's untransformed height — base for vertical % radii. */
  height: number;
}

/**
 * Map CSS per-corner border-radius to Penpot's `r1..r4`. The converter assigns
 * `r1=top-left, r2=top-right, r3=bottom-right, r4=bottom-left` (visual/radius.ts),
 * we follow the same convention.
 *
 * Browsers preserve `%` in the *computed* value of border-radius (e.g.
 * `border-radius:50%` returns `"50%"` from `getComputedStyle`, not the
 * resolved px). The percentage refers to the corresponding border-box
 * dimension — but Penpot stores a single scalar per corner, so we resolve
 * against `min(width, height)` to keep the corner from exceeding either half-
 * cap. For a 46×46 badge that round-trips `border-radius:50%` to `r=23`,
 * giving the expected circle.
 */
export function radiusFromComputed(
  style: PickedComputedStyle,
  base: RadiusBase,
): RadiusValues {
  const ref = Math.min(base.width, base.height);
  const tl = parseLengthOrPct(style.borderTopLeftRadius, ref) ?? 0;
  const tr = parseLengthOrPct(style.borderTopRightRadius, ref) ?? 0;
  const br = parseLengthOrPct(style.borderBottomRightRadius, ref) ?? 0;
  const bl = parseLengthOrPct(style.borderBottomLeftRadius, ref) ?? 0;

  if (tl === 0 && tr === 0 && br === 0 && bl === 0) return {};
  return { r1: tl, r2: tr, r3: br, r4: bl };
}
