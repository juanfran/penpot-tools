import type { ShapeCommon, FrameShape, LayoutItemAlignSelf } from '../../penpot.types';
import { px } from '../utils/css';
import { mergeStyles } from '../utils/style';

export function layoutItemSizingStyle(shape: ShapeCommon, parent: FrameShape): string {
  const isRowDir =
    parent.layoutFlexDir === 'row' ||
    parent.layoutFlexDir === 'row-reverse' ||
    parent.layoutFlexDir === undefined;

  const hSizing = shape.layoutItemHSizing;
  const vSizing = shape.layoutItemVSizing;

  const parts: string[] = [];

  if (hSizing === 'fill') {
    // Main axis (row → h-fill): flex: 1 to grow within the flow.
    // Cross axis (column → h-fill): explicit px to prevent content overflow
    // from inflating the flex container's cross-axis size.
    parts.push(isRowDir ? 'flex: 1;' : `width: ${px(shape.width ?? 0)};`);
  } else if (hSizing !== 'auto') {
    parts.push(`width: ${px(shape.width ?? 0)};`);
  }

  if (vSizing === 'fill') {
    parts.push(isRowDir ? 'height: 100%;' : 'flex: 1;');
  } else if (vSizing !== 'auto') {
    parts.push(`height: ${px(shape.height ?? 0)};`);
  }

  return parts.join(' ');
}

export function layoutItemMarginStyle(shape: ShapeCommon): string {
  const margin = shape.layoutItemMargin;
  if (!margin) return '';

  const { m1, m2, m3, m4 } = margin;

  if (m1 === m2 && m2 === m3 && m3 === m4) {
    return `margin: ${px(m1)};`;
  }

  return `margin: ${m1}px ${m2}px ${m3}px ${m4}px;`;
}

const ALIGN_SELF_VALUE: Record<LayoutItemAlignSelf, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

export function layoutItemAlignSelfStyle(shape: ShapeCommon): string {
  if (shape.layoutItemAlignSelf === undefined) return '';
  return `align-self: ${ALIGN_SELF_VALUE[shape.layoutItemAlignSelf]};`;
}

export function layoutItemMinMaxStyle(shape: ShapeCommon): string {
  const parts: string[] = [];
  if (shape.layoutItemMinW !== undefined) parts.push(`min-width: ${px(shape.layoutItemMinW)};`);
  if (shape.layoutItemMaxW !== undefined) parts.push(`max-width: ${px(shape.layoutItemMaxW)};`);
  if (shape.layoutItemMinH !== undefined) parts.push(`min-height: ${px(shape.layoutItemMinH)};`);
  if (shape.layoutItemMaxH !== undefined) parts.push(`max-height: ${px(shape.layoutItemMaxH)};`);
  return parts.join(' ');
}

export function layoutItemZIndexStyle(shape: ShapeCommon): string {
  if (shape.layoutItemZIndex === undefined || shape.layoutItemZIndex === 0) return '';
  return `z-index: ${shape.layoutItemZIndex};`;
}

export function layoutItemAbsoluteStyle(shape: ShapeCommon, offsetX = 0, offsetY = 0): string {
  if (!shape.layoutItemAbsolute) return '';
  const x = (shape.x ?? 0) - offsetX;
  const y = (shape.y ?? 0) - offsetY;
  return mergeStyles('position: absolute;', `left: ${px(x)};`, `top: ${px(y)};`);
}
