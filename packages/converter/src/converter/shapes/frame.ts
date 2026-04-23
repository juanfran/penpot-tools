import type { FrameShape, Shape } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { tag } from '../utils/html';
import { px } from '../utils/css';
import { mergeStyles } from '../utils/style';
import { baseStyles } from '../visual/base';
import { fillsToOutput } from '../visual/fills';
import { solidStrokeToStyle } from '../visual/strokes';
import { resolvePositionOutput } from '../visual/position';
import { flexContainerStyle, flexSpacingStyle } from '../layout/flex';
import {
  layoutItemSizingStyle,
  layoutItemMarginStyle,
  layoutItemAlignSelfStyle,
  layoutItemMinMaxStyle,
  layoutItemZIndexStyle,
  layoutItemAbsoluteStyle,
} from '../layout/layout-item';
import { gridTracksToStyle, gridCellStyle, findCellForShape } from '../layout/grid';
import { renderShape } from './dispatch';

export function renderFrame(
  shape: FrameShape,
  children: Shape[],
  objects: Record<string, Shape>,
  ctx: ConverterContext,
): string {
  const isRoot = shape.parentId === shape.id;
  const rawLayout = (shape as unknown as { layout?: string }).layout;
  const isFlex = shape.layoutType === 'flex' || rawLayout === 'flex';
  const isGrid = shape.layoutType === 'grid' || rawLayout === 'grid';
  const base = baseStyles(shape, ctx);
  const fills = fillsToOutput(shape.fills, ctx, shape.appliedTokens?.fill);
  const clipStyle = shape.clipContent !== false && !shape.showContent ? 'overflow: hidden;' : '';
  const firstStroke = (shape.strokes ?? [])[0];
  const stroke = firstStroke
    ? solidStrokeToStyle(firstStroke, shape.appliedTokens?.strokeColor, ctx.tokens)
    : '';

  let positionStyle = '';
  if (isRoot) {
    positionStyle = `position: relative; width: ${px(shape.width)}; height: ${px(shape.height)};`;
  } else {
    positionStyle = resolvePositionOutput(shape, ctx);
  }

  let layoutStyle = '';
  if (isFlex) {
    layoutStyle = mergeStyles(flexContainerStyle(shape), flexSpacingStyle(shape));
  } else if (isGrid) {
    const spacing = flexSpacingStyle(shape);
    const colStyle = gridTracksToStyle(shape.layoutGridColumns ?? [], 'columns');
    const rowStyle = gridTracksToStyle(shape.layoutGridRows ?? [], 'rows');
    layoutStyle = mergeStyles('display: grid;', colStyle, rowStyle, spacing);
  }

  const bgStyle = isRoot && ctx._pageBackground ? `background-color: ${ctx._pageBackground};` : '';

  const hasAbsoluteChild =
    (isFlex || isGrid) &&
    children.some((c) => (c as unknown as { layoutItemAbsolute?: boolean }).layoutItemAbsolute);

  // A plain frame with children acts as a containing block for its absolutely-positioned
  // children. When it's inside a flex/grid parent, positionStyle has no CSS position
  // (only width/height), leaving it as position: static which does not create a
  // containing block. Add position: relative in that case.
  const plainFrameNeedsRelative =
    !isFlex && !isGrid && !isRoot && children.length > 0 && ctx._parentIsLayout;

  // If the shape itself is layoutItemAbsolute, the layout-item style already emits
  // position: absolute, which creates a containing block. Adding position: relative
  // on top would override the absolute positioning and place the shape in flex flow.
  const needsContainingBlock =
    !shape.layoutItemAbsolute &&
    (plainFrameNeedsRelative || (hasAbsoluteChild && ctx._parentIsLayout));

  const extraPositionStyle = needsContainingBlock ? 'position: relative;' : '';

  const style = mergeStyles(
    positionStyle,
    extraPositionStyle,
    layoutStyle,
    base,
    fills,
    stroke,
    clipStyle,
    bgStyle,
  );

  let inner: string;
  if (isFlex) {
    const flexDir = shape.layoutFlexDir;
    const isReverseDir = flexDir === 'row-reverse' || flexDir === 'column-reverse';
    const frameOffsetX = shape.x ?? 0;
    const frameOffsetY = shape.y ?? 0;
    const orderedChildren = isReverseDir ? [...children] : [...children].reverse();
    inner = orderedChildren
      .map((child) => {
        // Absolute flex items are removed from flex flow; `flex: 1` / `height: 100%`
        // sizing no longer applies, so the child emits its own explicit px dimensions
        // and the sizing style is skipped (the absolute-position style provides placement).
        const isAbsolute = !!(child as unknown as { layoutItemAbsolute?: boolean })
          .layoutItemAbsolute;
        const autoW = isAbsolute || child.layoutItemHSizing === 'auto';
        const autoH = isAbsolute || child.layoutItemVSizing === 'auto';
        const sizingStyle = isAbsolute ? '' : layoutItemSizingStyle(child, shape);
        const itemStyle = mergeStyles(
          sizingStyle,
          layoutItemMarginStyle(child),
          layoutItemAlignSelfStyle(child),
          layoutItemMinMaxStyle(child),
          layoutItemZIndexStyle(child),
          layoutItemAbsoluteStyle(child, frameOffsetX, frameOffsetY),
        );
        const flexCtx: ConverterContext = {
          ...ctx,
          _parentIsLayout: true,
          _parentIsLayoutAutoW: autoW || undefined,
          _parentIsLayoutAutoH: autoH || undefined,
          _parentLayoutItemStyles: itemStyle || undefined,
        };
        return renderShape(child, objects, flexCtx);
      })
      .join('');
  } else if (isGrid) {
    inner = children
      .map((child) => {
        const cell = findCellForShape(shape, child.id);
        const cellStyle = cell ? gridCellStyle(cell) : '';
        const gridCtx: ConverterContext = {
          ...ctx,
          _forceRelative: true,
          _parentLayoutItemStyles: cellStyle || undefined,
        };
        return renderShape(child, objects, gridCtx);
      })
      .join('');
  } else {
    const childCtx: ConverterContext = {
      ...ctx,
      _isCanvasTopLevel: false,
      _isChildOfRoot: isRoot,
      _forceRelative: false,
      _parentIsLayout: false,
      _parentIsLayoutAutoW: undefined,
      _parentIsLayoutAutoH: undefined,
      _parentLayoutItemStyles: undefined,
      _offsetX: shape.x ?? 0,
      _offsetY: shape.y ?? 0,
    };
    inner = children.map((child) => renderShape(child, objects, childCtx)).join('');
  }

  return tag(
    'div',
    { 'data-id': shape.id, 'data-type': shape.type, style: style || undefined },
    inner,
  );
}
