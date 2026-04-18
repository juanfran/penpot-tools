import type { ShapeCommon } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { isIdentityMatrix, matrixToCss } from '../utils/transform';
import { mergeStyles } from '../utils/style';
import { px } from '../utils/css';

export function combinedTransformStyle(shape: ShapeCommon): string {
  const hasRotation = !!shape.rotation;
  const hasMatrix = shape.transform !== undefined && !isIdentityMatrix(shape.transform);

  if (!hasRotation && !hasMatrix) return '';

  const parts: string[] = [];
  if (hasRotation) parts.push(`rotate(${-(shape.rotation ?? 0)}deg)`);
  if (hasMatrix) parts.push(matrixToCss(shape.transform!));

  return `transform: ${parts.join(' ')};`;
}

export function absolutePositionStyle(
  shape: ShapeCommon,
  isChildOfRoot = false,
  offsetX = 0,
  offsetY = 0,
): string {
  const position = isChildOfRoot && shape.fixedScroll ? 'fixed' : 'absolute';
  const x = (shape.x ?? 0) - offsetX;
  const y = (shape.y ?? 0) - offsetY;
  return [
    `position: ${position};`,
    `left: ${px(x)};`,
    `top: ${px(y)};`,
    `width: ${px(shape.width ?? 0)};`,
    `height: ${px(shape.height ?? 0)};`,
  ].join(' ');
}

function relativePositionStyle(shape: ShapeCommon): string {
  return `position: relative; width: ${px(shape.width ?? 0)}; height: ${px(shape.height ?? 0)};`;
}

export function topLevelPositionStyle(shape: ShapeCommon, isChildOfRoot = false): string {
  const position = isChildOfRoot && shape.fixedScroll ? 'fixed' : 'absolute';
  const x = shape.x ?? 0;
  const y = shape.y ?? 0;
  return mergeStyles(
    `position: ${position};`,
    'top: 0px;',
    'left: 0px;',
    `width: ${px(shape.width ?? 0)};`,
    `height: ${px(shape.height ?? 0)};`,
    `transform: translate(${px(x)}, ${px(y)});`,
  );
}

export function resolvePositionOutput(shape: ShapeCommon, ctx: ConverterContext): string {
  if (ctx._parentIsLayout) {
    const w = ctx._parentIsLayoutAutoW ? `width: ${px(shape.width ?? 0)};` : 'width: 100%;';
    const h = ctx._parentIsLayoutAutoH ? `height: ${px(shape.height ?? 0)};` : 'height: 100%;';
    return `${w} ${h}`;
  }
  if (ctx._forceRelative) return relativePositionStyle(shape);
  if (ctx._isCanvasTopLevel) return topLevelPositionStyle(shape, ctx._isChildOfRoot);
  return absolutePositionStyle(shape, ctx._isChildOfRoot, ctx._offsetX ?? 0, ctx._offsetY ?? 0);
}
