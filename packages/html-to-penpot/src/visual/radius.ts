import type { PickedComputedStyle } from '../types';
import { parsePx } from '../build/css';

export interface RadiusValues {
  r1?: number;
  r2?: number;
  r3?: number;
  r4?: number;
}

/**
 * Map CSS per-corner border-radius to Penpot's `r1..r4`. The converter assigns
 * `r1=top-left, r2=top-right, r3=bottom-right, r4=bottom-left` (visual/radius.ts),
 * we follow the same convention.
 *
 * Radii in browser computed style come back as `Npx` (single value) regardless
 * of the original shorthand, so we just parse each corner.
 */
export function radiusFromComputed(style: PickedComputedStyle): RadiusValues {
  const tl = parsePx(style.borderTopLeftRadius) ?? 0;
  const tr = parsePx(style.borderTopRightRadius) ?? 0;
  const br = parsePx(style.borderBottomRightRadius) ?? 0;
  const bl = parsePx(style.borderBottomLeftRadius) ?? 0;

  if (tl === 0 && tr === 0 && br === 0 && bl === 0) return {};
  return { r1: tl, r2: tr, r3: br, r4: bl };
}
