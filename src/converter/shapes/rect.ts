import type { RectShape, ShapeCommon } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { tag } from '../utils/html';
import { cls } from '../utils/tailwind';
import { mergeStyles } from '../utils/style';
import {
  absolutePositionClasses,
  relativePositionClasses,
} from '../visual/position';
import { baseClasses } from '../visual/base';
import { fillsToOutput } from '../visual/fills';

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
  const fills = fillsToOutput(shape.fills, ctx);

  const classes = cls(
    ctx._parentIsLayout
      ? undefined
      : ctx._forceRelative
        ? relativePositionClasses(shape)
        : absolutePositionClasses(shape, ctx._isChildOfRoot),
    base.classes,
    fills.classes,
  );
  const style = mergeStyles(base.style, fills.style);

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
