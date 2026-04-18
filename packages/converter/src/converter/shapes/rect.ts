import type { RectShape, ShapeCommon } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { tag } from '../utils/html';
import { mergeStyles } from '../utils/style';
import { resolvePositionOutput } from '../visual/position';
import { baseStyles } from '../visual/base';
import { fillsToOutput } from '../visual/fills';
import { solidStrokeToStyle } from '../visual/strokes';

export function renderRect(
  shape: RectShape,
  _parent: ShapeCommon | null,
  ctx: ConverterContext,
): string {
  const base = baseStyles(shape, ctx);
  const fills = fillsToOutput(shape.fills, ctx, shape.appliedTokens?.fill);
  const posStyle = resolvePositionOutput(shape, ctx);
  const firstStroke = (shape.strokes ?? [])[0];
  const stroke = firstStroke
    ? solidStrokeToStyle(firstStroke, shape.appliedTokens?.strokeColor)
    : '';

  const style = mergeStyles(posStyle, base, fills, stroke);

  return tag('div', { 'data-id': shape.id, style: style || undefined }, '');
}
