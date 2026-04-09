import type { CircleShape, ShapeCommon } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { tag } from '../utils/html';
import { cls } from '../utils/tailwind';
import { mergeStyles } from '../utils/style';
import { resolvePositionOutput } from '../visual/position';
import { baseClasses } from '../visual/base';
import { fillsToOutput } from '../visual/fills';

/**
 * Renders a Penpot `CircleShape` (ellipse) as an HTML `<div>`.
 *
 * - Perfect circle (width === height): uses `rounded-full` Tailwind class.
 * - Ellipse (width ≠ height): uses `border-radius: 50%` inline style.
 *
 * The `data-id` attribute carries the Penpot shape ID.
 */
export function renderCircle(
  shape: CircleShape,
  _parent: ShapeCommon | null,
  ctx: ConverterContext,
): string {
  const base = baseClasses(shape, ctx);
  const fills = fillsToOutput(shape.fills, ctx);
  const posOut = resolvePositionOutput(shape, ctx);

  const isCircle = shape.width === shape.height;
  const radiusClass = isCircle ? 'rounded-full' : undefined;
  const radiusStyle = isCircle ? '' : 'border-radius: 50%;';

  const classes = cls(posOut.classes, base.classes, fills.classes, radiusClass);
  const style = mergeStyles(posOut.style, base.style, fills.style, radiusStyle);

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
