import type { BoolShape } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { tag } from '../utils/html';
import { mergeStyles } from '../utils/style';
import { resolvePositionOutput } from '../visual/position';
import { baseStylesNoTransform } from '../visual/base';
import { decl } from '../decl';
import { hexOpacityToCss } from '../utils/color';
import { shapeBox } from '../utils/geometry';

export function renderBool(shape: BoolShape, ctx: ConverterContext): string {
  // Bool content is stored in page coordinates with rotation already applied,
  // so no CSS transform, and the svg must not clip the corners that stick out
  // of the unrotated selrect (same as paths).
  const base = baseStylesNoTransform(shape, ctx);

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

  const strokeWidthAttr = firstStroke?.strokeWidth ? String(firstStroke.strokeWidth) : undefined;

  const box = shapeBox(shape);
  const pathEl = tag('path', {
    d: shape.content,
    transform: `translate(${-box.x}, ${-box.y})`,
    fill: fillAttr,
    stroke: strokeAttr,
    'stroke-width': strokeWidthAttr,
  });

  const posStyle = resolvePositionOutput(shape, ctx);
  const style = mergeStyles(posStyle, base, decl.overflow('visible'));

  return tag(
    'svg',
    {
      'data-id': shape.id,
      'data-type': shape.type,
      width: String(box.width),
      height: String(box.height),
      xmlns: 'http://www.w3.org/2000/svg',
      style: style || undefined,
    },
    pathEl,
  );
}
