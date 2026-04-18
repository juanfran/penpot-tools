import type { FrameShape, FlexAlign, FlexDirection } from '../../penpot.types';
import { px } from '../utils/css';

const FLEX_DIR_VALUE: Record<FlexDirection, string> = {
  row: 'row',
  column: 'column',
  // Penpot's reverse directions store children in visual order (leftmost/topmost first),
  // unlike regular row/column where children are in Z-order (rightmost/bottommost first).
  // Using row / column (not CSS reverse) keeps the same justify-content semantics.
  'row-reverse': 'row',
  'column-reverse': 'column',
};

const ALIGN_ITEMS_VALUE: Partial<Record<FlexAlign, string>> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  'space-between': 'space-between',
  'space-around': 'space-around',
  'space-evenly': 'space-evenly',
};

const JUSTIFY_CONTENT_VALUE: Partial<Record<FlexAlign, string>> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  'space-between': 'space-between',
  'space-around': 'space-around',
  'space-evenly': 'space-evenly',
};

export function flexContainerStyle(shape: FrameShape): string {
  const parts: string[] = ['display: flex;'];

  if (shape.layoutFlexDir) {
    parts.push(`flex-direction: ${FLEX_DIR_VALUE[shape.layoutFlexDir]};`);
  }
  const alignValue = shape.layoutAlignItems ? ALIGN_ITEMS_VALUE[shape.layoutAlignItems] : undefined;
  if (alignValue) parts.push(`align-items: ${alignValue};`);

  const justifyValue = shape.layoutJustifyContent
    ? JUSTIFY_CONTENT_VALUE[shape.layoutJustifyContent]
    : undefined;
  if (justifyValue) parts.push(`justify-content: ${justifyValue};`);

  if (shape.layoutWrapType === 'wrap') parts.push('flex-wrap: wrap;');
  else if (shape.layoutWrapType === 'no-wrap') parts.push('flex-wrap: nowrap;');

  return parts.join(' ');
}

export function flexSpacingStyle(shape: FrameShape): string {
  const parts: string[] = [];

  const rawGap = (shape as unknown as { layoutGap?: { rowGap?: number; columnGap?: number } })
    .layoutGap;
  const rowGap = shape.layoutRowGap ?? rawGap?.rowGap;
  const colGap = shape.layoutColumnGap ?? rawGap?.columnGap;

  if (rowGap !== undefined && colGap !== undefined) {
    if (rowGap === colGap) {
      parts.push(`gap: ${px(rowGap)};`);
    } else {
      parts.push(`row-gap: ${px(rowGap)};`);
      parts.push(`column-gap: ${px(colGap)};`);
    }
  } else if (rowGap !== undefined) {
    parts.push(`row-gap: ${px(rowGap)};`);
  } else if (colGap !== undefined) {
    parts.push(`column-gap: ${px(colGap)};`);
  }

  const pad = shape.layoutPadding;
  if (pad) {
    const { p1, p2, p3, p4 } = pad;
    if (p1 === p2 && p2 === p3 && p3 === p4) {
      parts.push(`padding: ${px(p1)};`);
    } else {
      parts.push(`padding: ${p1}px ${p2}px ${p3}px ${p4}px;`);
    }
  }

  return parts.join(' ');
}
