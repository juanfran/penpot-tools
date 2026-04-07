import type { GeomMatrix, ShapeCommon } from '../../penpot.types';
import { isIdentityMatrix, matrixToCss } from '../utils/transform';
import { cls, pxClass } from '../utils/tailwind';
import { mergeStyles } from '../utils/style';

/**
 * Converts a Penpot rotation (counter-clockwise degrees) to a Tailwind `rotate-[Ndeg]` class.
 *
 * Penpot stores rotation in degrees CCW; CSS `rotate` is CW — the value is negated.
 * Returns `''` for `undefined` or `0`.
 */
export function rotationToClass(rotation: number | undefined): string {
  if (!rotation) return '';
  return `rotate-[${-rotation}deg]`;
}

/**
 * Converts a GeomMatrix to a CSS `transform: matrix(...)` inline style string.
 * Returns `''` when the matrix is the identity (no transform needed).
 */
export function transformToStyle(transform: GeomMatrix): string {
  if (isIdentityMatrix(transform)) return '';
  return `transform: ${matrixToCss(transform)};`;
}

/**
 * Returns Tailwind classes for absolute positioning with explicit size.
 *
 * Emits `absolute left-[Xpx] top-[Ypx] w-[Wpx] h-[Hpx]`.
 * Missing x/y/width/height default to `0`.
 *
 * When `isChildOfRoot` is true and `shape.fixedScroll === true`, emits `fixed`
 * instead of `absolute` to pin the element to the viewport.
 */
export function absolutePositionClasses(
  shape: ShapeCommon,
  isChildOfRoot = false,
): string {
  const posClass = isChildOfRoot && shape.fixedScroll ? 'fixed' : 'absolute';
  return cls(
    posClass,
    pxClass('left', shape.x ?? 0),
    pxClass('top', shape.y ?? 0),
    pxClass('w', shape.width ?? 0),
    pxClass('h', shape.height ?? 0),
  );
}

/**
 * Builds the final CSS `transform` property for a shape, composing
 * rotation and matrix if both are present.
 *
 * - Both present: `transform: rotate(Ndeg) matrix(a,b,c,d,e,f)`
 * - Rotation only: `transform: rotate(Ndeg)`
 * - Matrix only (non-identity): `transform: matrix(a,b,c,d,e,f)`
 * - Neither: `''`
 *
 * Penpot rotation is counter-clockwise; CSS is clockwise — the value is negated.
 */
export function combinedTransformStyle(shape: ShapeCommon): string {
  const hasRotation = !!shape.rotation;
  const hasMatrix =
    shape.transform !== undefined && !isIdentityMatrix(shape.transform);

  if (!hasRotation && !hasMatrix) return '';

  const parts: string[] = [];
  if (hasRotation) parts.push(`rotate(${-(shape.rotation ?? 0)}deg)`);
  if (hasMatrix) parts.push(matrixToCss(shape.transform!));

  return `transform: ${parts.join(' ')};`;
}

/**
 * Returns Tailwind classes for relative positioning with explicit size.
 * Used when a shape is the export root (`convertShape`).
 */
export function relativePositionClasses(shape: ShapeCommon): string {
  return cls(
    'relative',
    pxClass('w', shape.width ?? 0),
    pxClass('h', shape.height ?? 0),
  );
}

function pct(value: number, total: number): string {
  const rounded = Math.round((value / total) * 100 * 100) / 100;
  const formatted =
    rounded % 1 === 0
      ? String(rounded | 0)
      : rounded.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted}%`;
}

/**
 * Converts `shape.constraintsH` to CSS inline style properties for horizontal positioning.
 * Defaults to `'left'` when `constraintsH` is undefined.
 */
export function constraintsHToStyle(
  shape: ShapeCommon,
  parent: ShapeCommon,
): string {
  const x = shape.x ?? 0;
  const w = shape.width ?? 0;
  const pw = parent.width ?? 0;
  const constraint = shape.constraintsH ?? 'left';

  switch (constraint) {
    case 'left':
      return `left: ${x}px;`;
    case 'right':
      return `right: ${pw - x - w}px;`;
    case 'center':
      return 'left: 50%; transform: translateX(-50%);';
    case 'leftright':
      return mergeStyles(
        `left: ${x}px;`,
        `right: ${pw - x - w}px;`,
        'width: unset;',
      );
    case 'scale':
      return mergeStyles(`left: ${pct(x, pw)};`, `width: ${pct(w, pw)};`);
  }
}

/**
 * Converts `shape.constraintsV` to CSS inline style properties for vertical positioning.
 * Defaults to `'top'` when `constraintsV` is undefined.
 */
export function constraintsVToStyle(
  shape: ShapeCommon,
  parent: ShapeCommon,
): string {
  const y = shape.y ?? 0;
  const h = shape.height ?? 0;
  const ph = parent.height ?? 0;
  const constraint = shape.constraintsV ?? 'top';

  switch (constraint) {
    case 'top':
      return `top: ${y}px;`;
    case 'bottom':
      return `bottom: ${ph - y - h}px;`;
    case 'center':
      return 'top: 50%; transform: translateY(-50%);';
    case 'topbottom':
      return mergeStyles(
        `top: ${y}px;`,
        `bottom: ${ph - y - h}px;`,
        'height: unset;',
      );
    case 'scale':
      return mergeStyles(`top: ${pct(y, ph)};`, `height: ${pct(h, ph)};`);
  }
}
