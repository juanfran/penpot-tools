import type { PathShape, StrokeCap } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { tag } from '../utils/html';
import { cls } from '../utils/tailwind';
import { resolvePositionOutput } from '../visual/position';
import { baseClasses } from '../visual/base';
import { hexOpacityToCss } from '../utils/color';

/**
 * Builds an SVG `<marker>` element for a given stroke cap type and color.
 *
 * `orient="auto-start-reverse"` is used for all markers so that the same
 * definition works correctly when referenced by both `marker-start` and
 * `marker-end`: for start markers the browser automatically adds 180° of
 * rotation so the arrowhead points outward.
 *
 * Returns null for cap types that are not rendered as SVG markers (`round`,
 * `square`) — those are handled via `stroke-linecap` on the `<path>` itself.
 */
function buildMarkerDef(capType: StrokeCap, color: string, id: string): string | null {
  if (!capType || capType === 'round' || capType === 'square') return null;

  let inner: string;
  let viewBox: string;
  let refX: string;
  let refY: string;
  let markerWidth: string;
  let markerHeight: string;

  switch (capType) {
    case 'line-arrow':
      viewBox = '0 0 3 6';
      refX = '2';
      refY = '3';
      markerWidth = '8.5';
      markerHeight = '8.5';
      inner = tag('path', {
        d: 'M 0.5 0.5 L 3 3 L 0.5 5.5 L 0 5 L 2 3 L 0 1 z',
        fill: color,
        'fill-opacity': '1',
      });
      break;
    case 'triangle-arrow':
      viewBox = '0 0 6 6';
      refX = '3';
      refY = '3';
      markerWidth = '8.5';
      markerHeight = '8.5';
      inner = tag('path', {
        d: 'M 0 0 L 6 3 L 0 6 z',
        fill: color,
        'fill-opacity': '1',
      });
      break;
    case 'circle-marker':
      viewBox = '0 0 6 6';
      refX = '3';
      refY = '3';
      markerWidth = '5';
      markerHeight = '5';
      inner = tag('circle', { cx: '3', cy: '3', r: '2.5', fill: color, 'fill-opacity': '1' });
      break;
    case 'square-marker':
      viewBox = '0 0 6 6';
      refX = '3';
      refY = '3';
      markerWidth = '5';
      markerHeight = '5';
      inner = tag('rect', {
        x: '0.5',
        y: '0.5',
        width: '5',
        height: '5',
        fill: color,
        'fill-opacity': '1',
      });
      break;
    case 'diamond-marker':
      viewBox = '0 0 6 6';
      refX = '3';
      refY = '3';
      markerWidth = '5';
      markerHeight = '5';
      inner = tag('path', {
        d: 'M 3 0 L 6 3 L 3 6 L 0 3 z',
        fill: color,
        'fill-opacity': '1',
      });
      break;
    default:
      return null;
  }

  return tag(
    'marker',
    {
      id,
      viewBox,
      refX,
      refY,
      markerWidth,
      markerHeight,
      orient: 'auto-start-reverse',
    },
    inner,
  );
}

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
 *
 * Stroke caps (`strokeCapStart`, `strokeCapEnd`) that represent arrowheads or
 * shape markers are rendered as SVG `<marker>` elements inside `<defs>` and
 * referenced via `marker-start`/`marker-end` on the `<path>`. Round and square
 * caps are expressed via `stroke-linecap` instead.
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
  // defsInner accumulates inner content for the single <defs> block (pattern + markers).
  let defsInner = '';
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
    defsInner += patternEl;
    fillAttr = `url(#${patternId})`;
  } else if (firstFill?.fillColor) {
    fillAttr = hexOpacityToCss(firstFill.fillColor, firstFill.fillOpacity);
  } else {
    fillAttr = 'none';
  }

  const strokeColor = firstStroke?.strokeColor
    ? hexOpacityToCss(firstStroke.strokeColor, firstStroke.strokeOpacity)
    : undefined;

  const strokeWidthAttr = firstStroke?.strokeWidth ? String(firstStroke.strokeWidth) : undefined;

  // Build SVG marker defs and marker-start/marker-end references.
  let markerStartAttr: string | undefined;
  let markerEndAttr: string | undefined;
  let linecap: string | undefined;

  if (firstStroke) {
    const { strokeCapStart, strokeCapEnd } = firstStroke;
    const markerColor = strokeColor ?? 'black';

    // Round/square caps use stroke-linecap; all other caps use SVG markers.
    const linecapCap = strokeCapStart ?? strokeCapEnd;
    if (linecapCap === 'round' || linecapCap === 'square') {
      linecap = linecapCap;
    }

    if (strokeCapStart && strokeCapStart !== 'round' && strokeCapStart !== 'square') {
      const markerId = `marker-${shape.id}-start`;
      const markerDef = buildMarkerDef(strokeCapStart, markerColor, markerId);
      if (markerDef) {
        defsInner += markerDef;
        markerStartAttr = `url(#${markerId})`;
      }
    }

    if (strokeCapEnd && strokeCapEnd !== 'round' && strokeCapEnd !== 'square') {
      const markerId = `marker-${shape.id}-end`;
      const markerDef = buildMarkerDef(strokeCapEnd, markerColor, markerId);
      if (markerDef) {
        defsInner += markerDef;
        markerEndAttr = `url(#${markerId})`;
      }
    }
  }

  // Compose path style for properties that can't be expressed as plain SVG attributes.
  const pathStyleParts: string[] = [];
  if (linecap) pathStyleParts.push(`stroke-linecap:${linecap}`);
  if (markerStartAttr) pathStyleParts.push(`marker-start:${markerStartAttr}`);
  if (markerEndAttr) pathStyleParts.push(`marker-end:${markerEndAttr}`);
  const pathStyle = pathStyleParts.length ? pathStyleParts.join(';') : undefined;

  // The path uses its original page-absolute coordinates. The viewBox on the
  // SVG maps the bounding box region to the SVG viewport, so no transform is needed.
  const pathEl = tag('path', {
    d: shape.content,
    fill: fillAttr,
    stroke: strokeColor,
    'stroke-width': strokeWidthAttr,
    style: pathStyle,
  });

  // Supply computed geometry so resolvePositionOutput emits the right classes.
  const effectiveShape = { ...shape, x, y, width, height };
  const posOut = resolvePositionOutput(effectiveShape, ctx);
  const classes = cls(posOut.classes, base.classes);
  // Path coordinates in `content` are already in page-absolute space — rotation
  // and matrix are baked into the path data. Applying base.style (which contains
  // combinedTransformStyle) would double-transform and flip the shape.
  // posOut.style (translate for canvas-top-level) is still needed for placement.
  const style = posOut.style;

  const defs = defsInner ? tag('defs', {}, defsInner) : '';

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
