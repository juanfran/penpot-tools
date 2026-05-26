import type { ShapeCommon } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { mergeStyles } from '../utils/style';
import { blendModeToStyle, opacityToStyle, hiddenToStyle } from './blend';
import { blurToStyle } from './blur';
import { shadowsToStyle } from './shadows';
import { radiusToStyle } from './radius';
import { combinedTransformStyle } from './position';

export function baseStyles(shape: ShapeCommon, _ctx: ConverterContext): string {
  return mergeStyles(
    opacityToStyle(shape.opacity),
    blendModeToStyle(shape.blendMode),
    hiddenToStyle(shape.hidden),
    blurToStyle(shape.blur),
    radiusToStyle(shape),
    shadowsToStyle(shape.shadow),
    combinedTransformStyle(shape),
  );
}

/**
 * Same as `baseStyles` but skips `combinedTransformStyle`.
 *
 * Container shapes (frame, group) lay out their children with absolute
 * positions derived from each child's selrect — and selrects are already in
 * post-transform world coordinates. Applying the parent's CSS transform on
 * top would double-transform the subtree (e.g. a `flipY: true` frame would
 * visually mirror its children even though their world positions already
 * encode the flip).
 */
export function baseStylesNoTransform(shape: ShapeCommon, _ctx: ConverterContext): string {
  return mergeStyles(
    opacityToStyle(shape.opacity),
    blendModeToStyle(shape.blendMode),
    hiddenToStyle(shape.hidden),
    blurToStyle(shape.blur),
    radiusToStyle(shape),
    shadowsToStyle(shape.shadow),
  );
}
