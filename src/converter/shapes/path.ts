import type { PathShape } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { tag } from '../utils/html';
import { cls } from '../utils/tailwind';
import { mergeStyles } from '../utils/style';
import {
  absolutePositionClasses,
  relativePositionClasses,
} from '../visual/position';
import { baseClasses } from '../visual/base';
import { hexOpacityToCss } from '../utils/color';

/**
 * Renders a Penpot `PathShape` as an inline `<svg>` element.
 *
 * The SVG is sized to the shape bounding box and positioned absolutely.
 * The inner `<path>` is translated by `(-x, -y)` so it starts at `(0, 0)`
 * within the SVG viewport.
 *
 * Fill and stroke are taken from the first fill/stroke entry respectively.
 * The `data-id` attribute carries the Penpot shape ID.
 */
export function renderPath(shape: PathShape, ctx: ConverterContext): string {
  const base = baseClasses(shape, ctx);

  const fills = shape.fills ?? [];
  const strokes = shape.strokes ?? [];

  const firstFill = fills[0];
  const firstStroke = strokes[0];

  const fillAttr = firstFill?.fillColor
    ? hexOpacityToCss(firstFill.fillColor, firstFill.fillOpacity)
    : 'none';

  const strokeAttr = firstStroke?.strokeColor
    ? hexOpacityToCss(firstStroke.strokeColor, firstStroke.strokeOpacity)
    : undefined;

  const strokeWidthAttr = firstStroke?.strokeWidth
    ? String(firstStroke.strokeWidth)
    : undefined;

  const pathEl = tag('path', {
    d: shape.content,
    transform: `translate(${-(shape.x ?? 0)}, ${-(shape.y ?? 0)})`,
    fill: fillAttr,
    stroke: strokeAttr,
    'stroke-width': strokeWidthAttr,
  });

  const classes = cls(
    ctx._parentIsLayout
      ? undefined
      : ctx._forceRelative
        ? relativePositionClasses(shape)
        : absolutePositionClasses(shape, ctx._isChildOfRoot),
    base.classes,
  );
  const style = mergeStyles(base.style);

  return tag(
    'svg',
    {
      'data-id': shape.id,
      width: String(shape.width ?? 0),
      height: String(shape.height ?? 0),
      xmlns: 'http://www.w3.org/2000/svg',
      class: classes || undefined,
      style: style || undefined,
    },
    pathEl,
  );
}
