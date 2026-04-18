import type { ShapeCommon } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { mergeStyles } from '../utils/style';
import { blendModeToStyle, opacityToStyle, hiddenToStyle } from './blend';
import { blurToStyle } from './blur';
import { shadowsToStyle } from './shadows';
import { radiusToStyle } from './radius';
import { combinedTransformStyle } from './position';

export function baseStyles(
  shape: ShapeCommon,
  _ctx: ConverterContext,
): string {
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
