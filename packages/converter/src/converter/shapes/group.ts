import type { CircleShape, GroupShape, PathShape, Shape } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { tag } from '../utils/html';
import { mergeStyles } from '../utils/style';
import { resolvePositionOutput } from '../visual/position';
import { baseStyles } from '../visual/base';
import { hexOpacityToCss } from '../utils/color';
import { renderShape } from './dispatch';

function hasSvgPaths(children: Shape[]): boolean {
  return children.some((c) => c.type === 'path' && c.x == null);
}

function renderPathElement(shape: PathShape): string {
  const fills = shape.fills ?? [];
  const strokes = shape.strokes ?? [];
  const firstFill = fills[0];
  const firstStroke = strokes[0];

  const fillAttr = firstFill?.fillColor
    ? hexOpacityToCss(firstFill.fillColor, firstFill.fillOpacity ?? 1)
    : 'none';

  const strokeAttr = firstStroke?.strokeColor
    ? hexOpacityToCss(firstStroke.strokeColor, firstStroke.strokeOpacity ?? 1)
    : undefined;

  const strokeWidthAttr = firstStroke?.strokeWidth ? String(firstStroke.strokeWidth) : undefined;

  const svgAttrs =
    ((shape as unknown as Record<string, unknown>).svgAttrs as
      | Record<string, string>
      | undefined) ?? {};

  return tag('path', {
    d: shape.content,
    fill: fillAttr,
    stroke: strokeAttr,
    'stroke-width': strokeWidthAttr,
    'fill-rule': svgAttrs['fillRule'],
    'clip-rule': svgAttrs['clipRule'],
  });
}

function renderCircleElement(shape: CircleShape): string {
  const fills = shape.fills ?? [];
  const strokes = shape.strokes ?? [];
  const firstFill = fills[0];
  const firstStroke = strokes[0];

  const fillAttr = firstFill?.fillColor
    ? hexOpacityToCss(firstFill.fillColor, firstFill.fillOpacity ?? 1)
    : 'none';

  const strokeAttr = firstStroke?.strokeColor
    ? hexOpacityToCss(firstStroke.strokeColor, firstStroke.strokeOpacity ?? 1)
    : undefined;

  const strokeWidthAttr =
    firstStroke?.strokeWidth != null ? String(firstStroke.strokeWidth) : undefined;

  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  let rx = shape.width / 2;
  let ry = shape.height / 2;

  if (firstStroke?.strokeWidth) {
    const half = firstStroke.strokeWidth / 2;
    if (firstStroke.strokeAlignment === 'inner') {
      rx -= half;
      ry -= half;
    } else if (firstStroke.strokeAlignment === 'outer') {
      rx += half;
      ry += half;
    }
  }

  if (rx === ry) {
    return tag('circle', {
      cx: String(cx),
      cy: String(cy),
      r: String(rx),
      fill: fillAttr,
      stroke: strokeAttr,
      'stroke-width': strokeWidthAttr,
    });
  }
  return tag('ellipse', {
    cx: String(cx),
    cy: String(cy),
    rx: String(rx),
    ry: String(ry),
    fill: fillAttr,
    stroke: strokeAttr,
    'stroke-width': strokeWidthAttr,
  });
}

function renderGroupAsSvg(shape: GroupShape, children: Shape[], ctx: ConverterContext): string {
  const vx = shape.x;
  const vy = shape.y;
  const vw = shape.width;
  const vh = shape.height;

  const base = baseStyles(shape, ctx);
  const posStyle = resolvePositionOutput(shape, ctx);

  const style = mergeStyles(posStyle, base);

  const inner = children
    .filter((c) => !c.hidden)
    .map((c) => {
      if (c.type === 'path') return renderPathElement(c as PathShape);
      if (c.type === 'circle') return renderCircleElement(c as CircleShape);
      return '';
    })
    .filter(Boolean)
    .join('');

  return tag(
    'svg',
    {
      'data-id': shape.id,
      'data-type': shape.type,
      width: String(vw),
      height: String(vh),
      viewBox: `${vx} ${vy} ${vw} ${vh}`,
      xmlns: 'http://www.w3.org/2000/svg',
      fill: 'none',
      style: style || undefined,
    },
    inner,
  );
}

export function renderGroup(
  shape: GroupShape,
  children: Shape[],
  objects: Record<string, Shape>,
  ctx: ConverterContext,
): string {
  if (hasSvgPaths(children)) {
    return renderGroupAsSvg(shape, children, ctx);
  }

  const base = baseStyles(shape, ctx);
  const posStyle = resolvePositionOutput(shape, ctx);
  const maskStyle = shape.maskedGroup ? 'overflow: hidden;' : '';

  const style = mergeStyles(posStyle, base, maskStyle);

  const childCtx: ConverterContext = {
    ...ctx,
    _isCanvasTopLevel: false,
    _forceRelative: false,
    _offsetX: shape.x ?? 0,
    _offsetY: shape.y ?? 0,
  };
  const inner = children.map((child) => renderShape(child, objects, childCtx)).join('');

  return tag('div', { 'data-id': shape.id, 'data-type': shape.type, style: style || undefined }, inner);
}
