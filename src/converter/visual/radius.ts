import type { ShapeCommon } from '../../penpot.types';

/**
 * Converts Penpot corner radii to a Tailwind class or inline border-radius style.
 *
 * - All four radii equal → `rounded-[Npx]` Tailwind class
 * - Radii differ → inline `border-radius: r1 r2 r3 r4` style (CSS order: top-left, top-right, bottom-right, bottom-left)
 * - No radii set (all undefined) → empty output
 *
 * Missing radii are treated as `0`.
 */
export function radiusToOutput(shape: ShapeCommon): {
  classes: string;
  style: string;
} {
  const r1 = shape.r1 ?? 0;
  const r2 = shape.r2 ?? 0;
  const r3 = shape.r3 ?? 0;
  const r4 = shape.r4 ?? 0;

  // No radii defined at all
  if (
    shape.r1 === undefined &&
    shape.r2 === undefined &&
    shape.r3 === undefined &&
    shape.r4 === undefined
  ) {
    return { classes: '', style: '' };
  }

  if (r1 === r2 && r2 === r3 && r3 === r4) {
    return { classes: `rounded-[${r1}px]`, style: '' };
  }

  return {
    classes: '',
    style: `border-radius: ${r1}px ${r2}px ${r3}px ${r4}px;`,
  };
}
