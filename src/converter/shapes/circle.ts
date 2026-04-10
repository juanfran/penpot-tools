import type { CircleShape, ShapeCommon } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { tag } from '../utils/html';
import { cls } from '../utils/tailwind';
import { mergeStyles } from '../utils/style';
import { resolvePositionOutput } from '../visual/position';
import { baseClasses } from '../visual/base';
import { fillsToOutput } from '../visual/fills';
import { solidStrokeToClasses } from '../visual/strokes';

/**
 * Renders a Penpot `CircleShape` (ellipse) as an HTML `<div>`.
 *
 * - Perfect circle (width === height): uses `rounded-full` Tailwind class.
 * - Ellipse (width ≠ height): uses `rounded-[50%]` Tailwind class.
 *
 * The `data-id` attribute carries the Penpot shape ID.
 */
export function renderCircle(
  shape: CircleShape,
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

  const radiusClass = shape.width === shape.height ? 'rounded-full' : 'rounded-[50%]';

  const classes = cls(posOut.classes, base.classes, fills.classes, stroke.classes, radiusClass);
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
