import type { ShapeCommon } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { cls } from '../utils/tailwind';
import { mergeStyles } from '../utils/style';
import { blendModeToClass, opacityToClass, hiddenToClass } from './blend';
import { blurToClass } from './blur';
import { shadowsToClass } from './shadows';
import { radiusToOutput } from './radius';
import { combinedTransformStyle } from './position';

/**
 * Aggregates all common visual properties for a shape into `{ classes, style }`.
 *
 * Composes: rotation, opacity, blend mode, hidden, blur, shadows, and corner radius.
 * Used as the foundation for every shape renderer.
 */
export function baseClasses(
  shape: ShapeCommon,
  _ctx: ConverterContext,
): { classes: string; style: string } {
  const radius = radiusToOutput(shape);

  const classes = cls(
    opacityToClass(shape.opacity),
    blendModeToClass(shape.blendMode),
    hiddenToClass(shape.hidden),
    blurToClass(shape.blur),
    radius.classes,
    shadowsToClass(shape.shadow),
  );

  const style = mergeStyles(combinedTransformStyle(shape), radius.style);

  return { classes, style };
}
