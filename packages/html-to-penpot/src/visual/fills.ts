import type { Fill } from '@penpot-tools/converter/types';
import type { PickedComputedStyle } from '../types';
import { parseColor } from '../build/css';
import { gradientFillFromBackgroundImage } from './gradients';

/**
 * Extract Penpot fills from `background-color` and `background-image`.
 *
 * Penpot supports stacked fills (an array). We mirror CSS painting order:
 *   - `background-color` is the bottom layer
 *   - `background-image` (gradient / image url) is on top
 *
 * Image URL fills land in Phase 2 alongside the upload pipeline; for now an
 * `url(...)` background-image is ignored (warned upstream).
 */
export function fillsFromComputed(style: PickedComputedStyle): Fill[] {
  const fills: Fill[] = [];

  const solid = parseColor(style.backgroundColor);
  if (solid && solid.opacity > 0) {
    fills.push({ fillColor: solid.hex, fillOpacity: solid.opacity });
  }

  const gradient = gradientFillFromBackgroundImage(style.backgroundImage);
  if (gradient) fills.push(gradient);

  return fills;
}
