import type { RectShape, ShapeCommon } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { tag } from '../utils/html';
import { cls } from '../utils/tailwind';
import { mergeStyles } from '../utils/style';
import { resolvePositionOutput } from '../visual/position';
import { baseClasses } from '../visual/base';
import { fillsToOutput } from '../visual/fills';
import { solidStrokeToClasses } from '../visual/strokes';

/**
 * Renders a Penpot `RectShape` as an HTML `<div>`.
 *
 * Emits absolute position, base visual properties (opacity, blend, blur, shadow,
 * radius, rotation, hidden), and fill classes/style. The `data-id` attribute
 * carries the Penpot shape ID for downstream consumers.
 */
export function renderRect(
  shape: RectShape,
  _parent: ShapeCommon | null,
  ctx: ConverterContext,
): string {
  const base = baseClasses(shape, ctx);
  const fills = fillsToOutput(shape.fills, ctx, shape.appliedTokens?.fill);
  const posOut = resolvePositionOutput(shape, ctx);
  const firstStroke = (shape.strokes ?? [])[0];
  const stroke = firstStroke
    ? solidStrokeToClasses(firstStroke, shape.appliedTokens?.strokeColor)
    : { classes: '', style: '' };

  const classes = cls(posOut.classes, base.classes, fills.classes, stroke.classes);
  const style = mergeStyles(posOut.style, base.style, fills.style, stroke.style);

  return tag(
    'div',
    {
      'data-id': shape.id,
      class: classes || undefined,
      style: style || undefined,
    },
    '',
  );
}
