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
  let positionStyle: string;
  if (ctx._parentIsLayout) {
    const itemStyles = ctx._parentLayoutItemStyles ?? '';
    const itemHasWidth = /(^|\s|;)\s*width\s*:/.test(itemStyles);
    const itemHasHeight = /(^|\s|;)\s*height\s*:/.test(itemStyles);

    const parts: string[] = [];
    if (!itemHasWidth) {
      parts.push(ctx._parentIsLayoutAutoW ? `width: ${px(shape.width ?? 0)};` : 'width: 100%;');
    }
    if (!itemHasHeight) {
      parts.push(ctx._parentIsLayoutAutoH ? `height: ${px(shape.height ?? 0)};` : 'height: 100%;');
    }
    positionStyle = parts.join(' ');
  } else if (ctx._forceRelative) {
    positionStyle = relativePositionStyle(shape);
  } else if (ctx._isCanvasTopLevel) {
    positionStyle = topLevelPositionStyle(shape, ctx._isChildOfRoot);
  } else {
    positionStyle = absolutePositionStyle(
      shape,
      ctx._isChildOfRoot,
      ctx._offsetX ?? 0,
      ctx._offsetY ?? 0,
    );
  }

  if (ctx._parentLayoutItemStyles) {
    return mergeStyles(positionStyle, ctx._parentLayoutItemStyles);
  }
  return positionStyle;
}
