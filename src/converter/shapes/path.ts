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
 * The SVG uses a `viewBox` set to the shape's page-absolute bounding box so
 * the inner `<path>` can use its original page coordinates without a transform.
 *
 * When `shape.x/y/width/height` are null (e.g. boolean/difference path ops),
 * `shape.selrect` is used as the authoritative bounding box — it is the exact
 * value Penpot computes and what the design tool displays.
 *
 * Image fills use an SVG `<pattern>` anchored to the page-absolute bounding
 * box with `patternUnits="userSpaceOnUse"`. The `<image>` inside the pattern
 * covers the tile with `preserveAspectRatio="xMidYMid slice"`, which is
 * equivalent to CSS `background-size: cover; background-position: center`.
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

  // When shape geometry is null (boolean/difference path ops), fall back to
  // selrect — the exact bounding box Penpot computes (matches design tool).
  const x = shape.x ?? shape.selrect?.x ?? 0;
  const y = shape.y ?? shape.selrect?.y ?? 0;
  const width = shape.width ?? shape.selrect?.width ?? 0;
  const height = shape.height ?? shape.selrect?.height ?? 0;

  // For image fills: use an SVG <pattern> anchored to the page-absolute bounding
  // box. The <image> inside uses preserveAspectRatio="xMidYMid slice" which
  // centers and covers the shape area (equivalent to CSS background: cover center).
  // The pattern's patternUnits="userSpaceOnUse" means its x/y/width/height are in
  // the same coordinate system as the SVG viewBox (page coordinates).
  let fillAttr: string;
  let defs = '';
  if (firstFill?.fillImage) {
    const patternId = `img-${shape.id}`;
    const url = ctx.resolveImageUrl(firstFill.fillImage.id);
    const imageEl = tag('image', {
      href: url,
      x: '0',
      y: '0',
      width: String(width),
      height: String(height),
      preserveAspectRatio: 'xMidYMid slice',
    });
    const patternEl = tag(
      'pattern',
      {
        id: patternId,
        patternUnits: 'userSpaceOnUse',
        x: String(x),
        y: String(y),
        width: String(width),
        height: String(height),
      },
      imageEl,
    );
    defs = tag('defs', {}, patternEl);
    fillAttr = `url(#${patternId})`;
  } else if (firstFill?.fillColor) {
    fillAttr = hexOpacityToCss(firstFill.fillColor, firstFill.fillOpacity);
  } else {
    fillAttr = 'none';
  }

  const strokeAttr = firstStroke?.strokeColor
    ? hexOpacityToCss(firstStroke.strokeColor, firstStroke.strokeOpacity)
    : undefined;

  const strokeWidthAttr = firstStroke?.strokeWidth
    ? String(firstStroke.strokeWidth)
    : undefined;

  // The path uses its original page-absolute coordinates. The viewBox on the
  // SVG maps the bounding box region to the SVG viewport, so no transform is needed.
  const pathEl = tag('path', {
    d: shape.content,
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
      viewBox: `${x} ${y} ${width} ${height}`,
      overflow: 'visible',
      xmlns: 'http://www.w3.org/2000/svg',
      class: classes || undefined,
      style: style || undefined,
    },
    defs + pathEl,
  );
}
