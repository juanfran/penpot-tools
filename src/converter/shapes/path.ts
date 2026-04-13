import type { PathShape } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { tag } from '../utils/html';
import { cls } from '../utils/tailwind';
import { mergeStyles } from '../utils/style';
import { resolvePositionOutput } from '../visual/position';
import { baseClasses } from '../visual/base';
import { hexOpacityToCss } from '../utils/color';

/**
 * Renders a Penpot `PathShape` as an inline `<svg>` element.
 *
 * The SVG is sized to the shape bounding box and positioned absolutely.
 * The inner `<path>` is translated by `(-x, -y)` so it starts at `(0, 0)`
 * within the SVG viewport.
 *
 * When `shape.x/y/width/height` are null (e.g. boolean/difference path ops),
 * `shape.selrect` is used as the authoritative bounding box — it is the exact
 * value Penpot computes and what the design tool displays.
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

  // When shape geometry is null (boolean/difference path ops), fall back to
  // selrect — the exact bounding box Penpot computes (matches design tool).
  const x = shape.x ?? shape.selrect?.x ?? 0;
  const y = shape.y ?? shape.selrect?.y ?? 0;
  const width = shape.width ?? shape.selrect?.width ?? 0;
  const height = shape.height ?? shape.selrect?.height ?? 0;

  const pathEl = tag('path', {
    d: shape.content,
    transform: `translate(${-x}, ${-y})`,
    fill: fillAttr,
    stroke: strokeAttr,
    'stroke-width': strokeWidthAttr,
  });

  // Supply computed geometry so resolvePositionOutput emits the right classes.
  const effectiveShape = { ...shape, x, y, width, height };
  const posOut = resolvePositionOutput(effectiveShape, ctx);
  const classes = cls(posOut.classes, base.classes);
  const style = mergeStyles(posOut.style, base.style);

  return tag(
    'svg',
    {
      'data-id': shape.id,
      width: String(width),
      height: String(height),
      overflow: 'visible',
      xmlns: 'http://www.w3.org/2000/svg',
      class: classes || undefined,
      style: style || undefined,
    },
    pathEl,
  );
}
