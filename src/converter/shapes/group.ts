import type { GroupShape, Shape } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { tag } from '../utils/html';
import { cls } from '../utils/tailwind';
import { mergeStyles } from '../utils/style';
import {
  absolutePositionClasses,
  relativePositionClasses,
} from '../visual/position';
import { baseClasses } from '../visual/base';
import { renderShape } from './dispatch';

/**
 * Renders a Penpot `GroupShape` as an absolutely-positioned `<div>` container.
 *
 * The group itself has no background; it provides a coordinate space for children.
 * Each child is recursively rendered via `renderShape`.
 *
 * If `shape.maskedGroup === true`, `overflow-hidden` is added so the first child
 * acts as a visual clip mask (simplified CSS approximation).
 *
 * The `data-id` attribute carries the Penpot shape ID.
 */
export function renderGroup(
  shape: GroupShape,
  children: Shape[],
  objects: Record<string, Shape>,
  ctx: ConverterContext,
): string {
  const base = baseClasses(shape, ctx);
  const maskClass = shape.maskedGroup ? 'overflow-hidden' : undefined;

  const classes = cls(
    ctx._parentIsLayout
      ? undefined
      : ctx._forceRelative
        ? relativePositionClasses(shape)
        : absolutePositionClasses(shape, ctx._isChildOfRoot),
    base.classes,
    maskClass,
  );
  const style = mergeStyles(base.style);

  const inner = children
    .map((child) => renderShape(child, objects, ctx))
    .join('');

  return tag(
    'div',
    {
      'data-id': shape.id,
      class: classes || undefined,
      style: style || undefined,
    },
    inner,
  );
}
