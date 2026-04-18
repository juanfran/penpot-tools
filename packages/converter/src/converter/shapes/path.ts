import type { PathShape, StrokeCap } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { tag } from '../utils/html';
import { mergeStyles } from '../utils/style';
import { resolvePositionOutput } from '../visual/position';
import { blendModeToStyle, opacityToStyle, hiddenToStyle } from '../visual/blend';
import { blurToStyle } from '../visual/blur';
import { shadowsToStyle } from '../visual/shadows';
import { radiusToStyle } from '../visual/radius';
import { hexOpacityToCss } from '../utils/color';

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
    { id, viewBox, refX, refY, markerWidth, markerHeight, orient: 'auto-start-reverse' },
    inner,
  );
}

export function renderPath(shape: PathShape, ctx: ConverterContext): string {
  const fills = shape.fills ?? [];
  const strokes = shape.strokes ?? [];

  const firstFill = fills[0];
  const firstStroke = strokes[0];

  const x = shape.x ?? shape.selrect?.x ?? 0;
  const y = shape.y ?? shape.selrect?.y ?? 0;
  const width = shape.width ?? shape.selrect?.width ?? 0;
  const height = shape.height ?? shape.selrect?.height ?? 0;

  let fillAttr: string;
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

  let markerStartAttr: string | undefined;
  let markerEndAttr: string | undefined;
  let linecap: string | undefined;

  if (firstStroke) {
    const { strokeCapStart, strokeCapEnd } = firstStroke;
    const markerColor = strokeColor ?? 'black';

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

  const pathStyleParts: string[] = [];
  if (linecap) pathStyleParts.push(`stroke-linecap:${linecap}`);
  if (markerStartAttr) pathStyleParts.push(`marker-start:${markerStartAttr}`);
  if (markerEndAttr) pathStyleParts.push(`marker-end:${markerEndAttr}`);
  const pathStyle = pathStyleParts.length ? pathStyleParts.join(';') : undefined;

  const pathEl = tag('path', {
    d: shape.content,
    fill: fillAttr,
    stroke: strokeColor,
    'stroke-width': strokeWidthAttr,
    style: pathStyle,
  });

  const effectiveShape = { ...shape, x, y, width, height };
  const posStyle = resolvePositionOutput(effectiveShape, ctx);

  // Path coordinates in `content` are already in page-absolute space — rotation
  // and matrix are baked into the path data. Applying transform styles would
  // double-transform and distort the shape. Only apply visual styles (not transform).
  const baseNoTransform = mergeStyles(
    opacityToStyle(shape.opacity),
    blendModeToStyle(shape.blendMode),
    hiddenToStyle(shape.hidden),
    blurToStyle(shape.blur),
    radiusToStyle(shape),
    shadowsToStyle(shape.shadow),
  );

  const style = mergeStyles(posStyle, baseNoTransform);

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
      style: style || undefined,
    },
    defs + pathEl,
  );
}
