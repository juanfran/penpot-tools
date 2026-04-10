import type {
  ShapeCommon,
  FrameShape,
  LayoutItemAlignSelf,
} from '../../penpot.types';
import { cls, pxClass } from '../utils/tailwind';

/**
 * Returns Tailwind sizing classes for a flex layout item.
 *
 * - `fill` on the main axis → `flex-1`; on the cross axis → `w-full` / `h-full`
 * - `fix` → explicit `w-[Npx]` / `h-[Npx]`
 * - `auto` → no class (natural size)
 *
 * The parent's `layoutFlexDir` determines which axis is main vs cross.
 */
export function layoutItemSizingClasses(
  shape: ShapeCommon,
  parent: FrameShape,
): string {
  const isRowDir =
    parent.layoutFlexDir === 'row' ||
    parent.layoutFlexDir === 'row-reverse' ||
    parent.layoutFlexDir === undefined;

  const hSizing = shape.layoutItemHSizing;
  const vSizing = shape.layoutItemVSizing;

  let hClass: string | undefined;
  let vClass: string | undefined;

  if (hSizing === 'fill') {
    hClass = isRowDir ? 'flex-1' : 'w-full';
  } else if (hSizing !== 'auto') {
    // 'fix' or undefined → use explicit pixel dimension
    hClass = pxClass('w', shape.width ?? 0);
  }

  if (vSizing === 'fill') {
    vClass = isRowDir ? 'h-full' : 'flex-1';
  } else if (vSizing !== 'auto') {
    // 'fix' or undefined → use explicit pixel dimension
    vClass = pxClass('h', shape.height ?? 0);
  }

  return cls(hClass, vClass);
}

/**
 * Returns Tailwind margin classes (or inline style fallback) for a flex layout item.
 *
 * - All sides equal → `m-[Npx]`
 * - top=bottom and left=right → `my-[Npx] mx-[Npx]`
 * - Otherwise → inline `margin: m1 m2 m3 m4` style
 * - Undefined margin → empty output
 */
export function layoutItemMarginClasses(shape: ShapeCommon): {
  classes: string;
  style: string;
} {
  const margin = shape.layoutItemMargin;
  if (!margin) return { classes: '', style: '' };

  const { m1, m2, m3, m4 } = margin;

  if (m1 === m2 && m2 === m3 && m3 === m4) {
    return { classes: pxClass('m', m1), style: '' };
  }

  if (m1 === m3 && m2 === m4) {
    return { classes: cls(pxClass('my', m1), pxClass('mx', m2)), style: '' };
  }

  return { classes: '', style: `margin: ${m1}px ${m2}px ${m3}px ${m4}px;` };
}

const alignSelfMap: Record<LayoutItemAlignSelf, string> = {
  start: 'self-start',
  center: 'self-center',
  end: 'self-end',
  stretch: 'self-stretch',
};

/**
 * Returns the Tailwind `self-*` class for a flex layout item's align-self property.
 */
export function layoutItemAlignSelfClass(shape: ShapeCommon): string {
  if (shape.layoutItemAlignSelf === undefined) return '';
  return alignSelfMap[shape.layoutItemAlignSelf];
}

/**
 * Returns Tailwind min/max size constraint classes for a layout item.
 */
export function layoutItemMinMaxClasses(shape: ShapeCommon): string {
  return cls(
    shape.layoutItemMinW !== undefined
      ? pxClass('min-w', shape.layoutItemMinW)
      : undefined,
    shape.layoutItemMaxW !== undefined
      ? pxClass('max-w', shape.layoutItemMaxW)
      : undefined,
    shape.layoutItemMinH !== undefined
      ? pxClass('min-h', shape.layoutItemMinH)
      : undefined,
    shape.layoutItemMaxH !== undefined
      ? pxClass('max-h', shape.layoutItemMaxH)
      : undefined,
  );
}

/**
 * Returns the Tailwind `z-[N]` class for a layout item with an explicit z-index override.
 */
export function layoutItemZIndexClass(shape: ShapeCommon): string {
  if (shape.layoutItemZIndex === undefined || shape.layoutItemZIndex === 0)
    return '';
  return `z-[${shape.layoutItemZIndex}]`;
}

/**
 * Returns absolute positioning classes for a layout item that is absolutely placed inside a flex/grid container.
 *
 * `offsetX` / `offsetY` must be the parent frame's canvas-absolute x/y so that the
 * position is expressed relative to the frame's top-left corner, not the canvas origin.
 */
export function layoutItemAbsoluteClasses(
  shape: ShapeCommon,
  offsetX = 0,
  offsetY = 0,
): string {
  if (!shape.layoutItemAbsolute) return '';
  return cls(
    'absolute',
    pxClass('left', (shape.x ?? 0) - offsetX),
    pxClass('top', (shape.y ?? 0) - offsetY),
  );
}
