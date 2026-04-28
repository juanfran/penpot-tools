import type { LayoutItemSizing } from '@penpot-tools/converter/types';
import type { PickedComputedStyle } from '../types';
import { parseNumber, parsePx } from '../build/css';

export interface LayoutItemFields {
  layoutItemHSizing?: LayoutItemSizing;
  layoutItemVSizing?: LayoutItemSizing;
}

function isRow(parentStyle: PickedComputedStyle): boolean {
  const dir = parentStyle.flexDirection;
  return dir === 'row' || dir === 'row-reverse' || dir === '' || dir === 'normal';
}

/**
 * Resolve `layoutItemH/VSizing` for a flex child from its computed style and
 * its parent's flex direction. Mirrors the converter's reverse mapping in
 * `layout/layout-item.ts`:
 *
 *   - flex-grow > 0 on the main axis → 'fill'
 *   - explicit width / height in px → 'fix'
 *   - otherwise → 'auto' (content-sized)
 *
 * `align-self: stretch` (or default with `align-items: stretch` on the parent)
 * maps to `'fill'` on the cross axis.
 */
export function layoutItemFromComputed(
  parentStyle: PickedComputedStyle,
  childStyle: PickedComputedStyle,
): LayoutItemFields {
  const row = isRow(parentStyle);
  const grow = parseNumber(childStyle.flexGrow) ?? 0;
  const widthPx = parsePx(childStyle.width);
  const heightPx = parsePx(childStyle.height);

  const crossStretch = parentStyle.alignItems === 'stretch' || parentStyle.alignItems === 'normal';

  let h: LayoutItemSizing;
  let v: LayoutItemSizing;

  if (row) {
    // Main axis = horizontal
    if (grow > 0) h = 'fill';
    else if (widthPx !== null) h = 'fix';
    else h = 'auto';
    // Cross axis = vertical
    if (crossStretch) v = 'fill';
    else if (heightPx !== null) v = 'fix';
    else v = 'auto';
  } else {
    // Main axis = vertical
    if (grow > 0) v = 'fill';
    else if (heightPx !== null) v = 'fix';
    else v = 'auto';
    // Cross axis = horizontal
    if (crossStretch) h = 'fill';
    else if (widthPx !== null) h = 'fix';
    else h = 'auto';
  }

  return { layoutItemHSizing: h, layoutItemVSizing: v };
}
