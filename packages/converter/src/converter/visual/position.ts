import type { ShapeCommon } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { isIdentityMatrix, matrixToCss } from '../utils/transform';
import { cls, pxClass } from '../utils/tailwind';

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
  offsetX = 0,
  offsetY = 0,
): string {
  const posClass = isChildOfRoot && shape.fixedScroll ? 'fixed' : 'absolute';
  return cls(
    posClass,
    pxClass('left', (shape.x ?? 0) - offsetX),
    pxClass('top', (shape.y ?? 0) - offsetY),
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
  const hasMatrix = shape.transform !== undefined && !isIdentityMatrix(shape.transform);

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
function relativePositionClasses(shape: ShapeCommon): string {
  return cls('relative', pxClass('w', shape.width ?? 0), pxClass('h', shape.height ?? 0));
}

/**
 * Returns position classes and a `transform: translate(x, y)` style for a
 * shape that sits at the first level of the canvas (direct child of the root
 * frame). Using translate instead of `top`/`left` keeps positional changes on
 * the compositor thread and avoids layout reflows.
 *
 * The element is always anchored at `top: 0; left: 0`; the visual offset is
 * expressed via the CSS `transform` property.
 */
export function topLevelPositionOutput(
  shape: ShapeCommon,
  isChildOfRoot = false,
): { classes: string; style: string } {
  const posClass = isChildOfRoot && shape.fixedScroll ? 'fixed' : 'absolute';
  const x = shape.x ?? 0;
  const y = shape.y ?? 0;
  return {
    classes: cls(
      posClass,
      'top-[0px]',
      'left-[0px]',
      pxClass('w', shape.width ?? 0),
      pxClass('h', shape.height ?? 0),
    ),
    style: `transform: translate(${x}px, ${y}px);`,
  };
}

/**
 * Resolves the CSS position output `{ classes, style }` for a shape based on
 * the current converter context. Centralises the four-way position dispatch
 * so every shape renderer can call a single function instead of repeating the
 * conditional chain.
 *
 * Priority (highest first):
 * 1. `_parentIsLayout` → no position output (layout container handles it)
 * 2. `_forceRelative`  → relative positioning (export-root use case)
 * 3. `_isCanvasTopLevel` → translate-based positioning (first-level canvas elements)
 * 4. default            → absolute positioning with top/left offsets
 */
export function resolvePositionOutput(
  shape: ShapeCommon,
  ctx: ConverterContext,
): { classes: string; style: string } {
  if (ctx._parentIsLayout) {
    const wClass = ctx._parentIsLayoutAutoW ? pxClass('w', shape.width ?? 0) : 'w-full';
    const hClass = ctx._parentIsLayoutAutoH ? pxClass('h', shape.height ?? 0) : 'h-full';
    return { classes: cls(wClass, hClass), style: '' };
  }
  if (ctx._forceRelative) return { classes: relativePositionClasses(shape), style: '' };
  if (ctx._isCanvasTopLevel) return topLevelPositionOutput(shape, ctx._isChildOfRoot);
  return {
    classes: absolutePositionClasses(
      shape,
      ctx._isChildOfRoot,
      ctx._offsetX ?? 0,
      ctx._offsetY ?? 0,
    ),
    style: '',
  };
}
