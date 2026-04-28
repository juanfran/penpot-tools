import type {
  FlexAlign,
  FlexDirection,
  FlexWrap,
  LayoutPadding,
  LayoutPaddingType,
} from '@penpot-tools/converter/types';
import type { PickedComputedStyle } from '../types';
import { parsePx } from '../build/css';

export interface FlexLayoutFields {
  layoutType: 'flex';
  layoutFlexDir?: FlexDirection;
  layoutAlignItems?: FlexAlign;
  layoutJustifyContent?: FlexAlign;
  layoutWrapType?: FlexWrap;
  layoutPaddingType?: LayoutPaddingType;
  layoutPadding?: LayoutPadding;
  layoutRowGap?: number;
  layoutColumnGap?: number;
}

const FLEX_DIR: Record<string, FlexDirection> = {
  row: 'row',
  column: 'column',
  'row-reverse': 'row-reverse',
  'column-reverse': 'column-reverse',
};

const ALIGN_ITEMS: Record<string, FlexAlign> = {
  'flex-start': 'start',
  start: 'start',
  center: 'center',
  'flex-end': 'end',
  end: 'end',
  stretch: 'stretch',
  baseline: 'start',
  normal: 'stretch',
};

const JUSTIFY_CONTENT: Record<string, FlexAlign> = {
  'flex-start': 'start',
  start: 'start',
  left: 'start',
  center: 'center',
  'flex-end': 'end',
  end: 'end',
  right: 'end',
  stretch: 'stretch',
  'space-between': 'space-between',
  'space-around': 'space-around',
  'space-evenly': 'space-evenly',
  normal: 'start',
};

/** Return the Penpot frame layout fields for a CSS flex container, or null if it isn't one. */
export function flexLayoutFromComputed(style: PickedComputedStyle): FlexLayoutFields | null {
  if (style.display !== 'flex' && style.display !== 'inline-flex') return null;

  const layoutFlexDir = FLEX_DIR[style.flexDirection] ?? 'row';
  const layoutAlignItems = ALIGN_ITEMS[style.alignItems];
  const layoutJustifyContent = JUSTIFY_CONTENT[style.justifyContent];

  // CSS default `flex-wrap: nowrap` matches Penpot's `'nowrap'` keyword (the
  // OpenAPI types claim `'no-wrap'` with a hyphen but the wire schema is the
  // CSS-native one-word form). `wrap-reverse` collapses to `wrap` — uncommon.
  const layoutWrapType = 'nowrap' as FlexWrap;

  const pTop = parsePx(style.paddingTop) ?? 0;
  const pRight = parsePx(style.paddingRight) ?? 0;
  const pBottom = parsePx(style.paddingBottom) ?? 0;
  const pLeft = parsePx(style.paddingLeft) ?? 0;
  const padUniform = pTop === pRight && pRight === pBottom && pBottom === pLeft;
  const layoutPadding: LayoutPadding | undefined =
    pTop || pRight || pBottom || pLeft
      ? { p1: pTop, p2: pRight, p3: pBottom, p4: pLeft }
      : undefined;
  const layoutPaddingType: LayoutPaddingType | undefined = layoutPadding
    ? padUniform
      ? 'simple'
      : 'multiple'
    : undefined;

  const rowGap = parsePx(style.rowGap);
  const colGap = parsePx(style.columnGap);

  return {
    layoutType: 'flex',
    layoutFlexDir,
    ...(layoutAlignItems ? { layoutAlignItems } : {}),
    ...(layoutJustifyContent ? { layoutJustifyContent } : {}),
    layoutWrapType,
    ...(layoutPadding ? { layoutPadding, layoutPaddingType: layoutPaddingType! } : {}),
    ...(rowGap !== null ? { layoutRowGap: rowGap } : {}),
    ...(colGap !== null ? { layoutColumnGap: colGap } : {}),
  };
}
