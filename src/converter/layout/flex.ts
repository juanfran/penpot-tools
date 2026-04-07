import type { FrameShape, FlexAlign, FlexDirection } from '../../penpot.types';
import { cls, pxClass } from '../utils/tailwind';

const FLEX_DIR_CLASS: Record<FlexDirection, string> = {
  row: 'flex-row',
  column: 'flex-col',
  'row-reverse': 'flex-row-reverse',
  'column-reverse': 'flex-col-reverse',
};

const ALIGN_ITEMS_CLASS: Partial<Record<FlexAlign, string>> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  'space-between': 'items-between',
  'space-around': 'items-around',
  'space-evenly': 'items-evenly',
};

const JUSTIFY_CONTENT_CLASS: Partial<Record<FlexAlign, string>> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  stretch: 'justify-stretch',
  'space-between': 'justify-between',
  'space-around': 'justify-around',
  'space-evenly': 'justify-evenly',
};

/**
 * Returns Tailwind flex container classes for a `FrameShape` with `layoutType === 'flex'`.
 *
 * Always includes `flex`. Maps `layoutFlexDir`, `layoutAlignItems`,
 * `layoutJustifyContent`, and `layoutWrapType` to their Tailwind equivalents.
 */
export function flexContainerClasses(shape: FrameShape): string {
  const dirClass = shape.layoutFlexDir
    ? FLEX_DIR_CLASS[shape.layoutFlexDir]
    : undefined;
  const alignClass = shape.layoutAlignItems
    ? ALIGN_ITEMS_CLASS[shape.layoutAlignItems]
    : undefined;
  const justifyClass = shape.layoutJustifyContent
    ? JUSTIFY_CONTENT_CLASS[shape.layoutJustifyContent]
    : undefined;
  const wrapClass =
    shape.layoutWrapType === 'wrap'
      ? 'flex-wrap'
      : shape.layoutWrapType === 'no-wrap'
        ? 'flex-nowrap'
        : undefined;

  return cls('flex', dirClass, alignClass, justifyClass, wrapClass);
}

/**
 * Returns Tailwind gap and padding classes (and inline style fallback) for a flex frame.
 *
 * Gap: equal row/col → `gap-[Npx]`; unequal → `gap-x-[Npx] gap-y-[Npx]`.
 * Padding: all equal → `p-[Npx]`; top=bottom & left=right → `px py`; else inline style.
 */
export function flexSpacingClasses(shape: FrameShape): {
  classes: string;
  style: string;
} {
  const gapClasses: string[] = [];

  const rowGap = shape.layoutRowGap;
  const colGap = shape.layoutColumnGap;

  if (rowGap !== undefined && colGap !== undefined) {
    if (rowGap === colGap) {
      gapClasses.push(pxClass('gap', rowGap));
    } else {
      gapClasses.push(pxClass('gap-y', rowGap));
      gapClasses.push(pxClass('gap-x', colGap));
    }
  } else if (rowGap !== undefined) {
    gapClasses.push(pxClass('gap-y', rowGap));
  } else if (colGap !== undefined) {
    gapClasses.push(pxClass('gap-x', colGap));
  }

  const pad = shape.layoutPadding;
  if (!pad) {
    return { classes: cls(...gapClasses), style: '' };
  }

  const { p1, p2, p3, p4 } = pad;

  if (p1 === p2 && p2 === p3 && p3 === p4) {
    return { classes: cls(...gapClasses, pxClass('p', p1)), style: '' };
  }

  if (p1 === p3 && p2 === p4) {
    return {
      classes: cls(...gapClasses, pxClass('py', p1), pxClass('px', p2)),
      style: '',
    };
  }

  return {
    classes: cls(...gapClasses),
    style: `padding: ${p1}px ${p2}px ${p3}px ${p4}px;`,
  };
}
