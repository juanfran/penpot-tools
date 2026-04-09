import type { FrameShape, Shape } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { tag } from '../utils/html';
import { cls } from '../utils/tailwind';
import { mergeStyles } from '../utils/style';
import { pxClass } from '../utils/tailwind';
import { baseClasses } from '../visual/base';
import { fillsToOutput } from '../visual/fills';
import { solidStrokeToClasses } from '../visual/strokes';
import {
  relativePositionClasses,
  resolvePositionOutput,
} from '../visual/position';
import { flexContainerClasses, flexSpacingClasses } from '../layout/flex';
import {
  layoutItemSizingClasses,
  layoutItemMarginClasses,
  layoutItemAlignSelfClass,
  layoutItemMinMaxClasses,
  layoutItemZIndexClass,
  layoutItemAbsoluteClasses,
} from '../layout/layout-item';
import {
  gridTracksToClass,
  gridCellClasses,
  findCellForShape,
} from '../layout/grid';
import { renderShape } from './dispatch';

/**
 * Renders a Penpot `FrameShape` as a `<div>`.
 *
 * - Root frame (parentId === id): uses `relative` positioning.
 * - Nested frame: uses `absolute` positioning via `absolutePositionClasses`.
 * - Flex layout frame: adds flex container classes; children receive layout-item classes.
 * - `overflow-hidden` is added when `shape.clipContent === true`.
 * - Children are recursively rendered via `renderShape`.
 * - The `data-id` attribute carries the Penpot shape ID.
 */
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
  const base = baseClasses(shape, ctx);
  const fills = fillsToOutput(shape.fills, ctx);
  const clipClass = shape.clipContent !== false ? 'overflow-hidden' : undefined;
  const firstStroke = (shape.strokes ?? [])[0];
  const stroke = firstStroke ? solidStrokeToClasses(firstStroke) : { classes: '', style: '' };

  let positionClasses: string;
  let positionStyle = '';
  if (isRoot) {
    positionClasses = cls(
      'relative',
      pxClass('w', shape.width),
      pxClass('h', shape.height),
    );
  } else {
    const posOut = resolvePositionOutput(shape, ctx);
    positionClasses = posOut.classes;
    positionStyle = posOut.style;
  }

  let layoutClasses = '';
  let layoutStyle = '';
  if (isFlex) {
    layoutClasses = flexContainerClasses(shape);
    const spacing = flexSpacingClasses(shape);
    layoutClasses = cls(layoutClasses, spacing.classes);
    layoutStyle = spacing.style;
  } else if (isGrid) {
    const spacing = flexSpacingClasses(shape);
    const colClass = gridTracksToClass(shape.layoutGridColumns ?? [], 'columns');
    const rowClass = gridTracksToClass(shape.layoutGridRows ?? [], 'rows');
    layoutClasses = cls('grid', colClass, rowClass, spacing.classes);
    layoutStyle = spacing.style;
  }

  const bgClass =
    isRoot && ctx._pageBackground ? `bg-[${ctx._pageBackground}]` : undefined;

  const classes = cls(
    positionClasses,
    layoutClasses,
    base.classes,
    fills.classes,
    stroke.classes,
    clipClass,
    bgClass,
  );
  const style = mergeStyles(positionStyle, layoutStyle, base.style, fills.style, stroke.style);

  let inner: string;
  if (isFlex) {
    const flexCtx: ConverterContext = { ...ctx, _parentIsLayout: true };
    const isReverse = shape.layoutFlexDir === 'column-reverse' || shape.layoutFlexDir === 'row-reverse';
    const orderedChildren = isReverse ? [...children].reverse() : children;
    inner = orderedChildren
      .map((child) => {
        const itemClasses = cls(
          layoutItemSizingClasses(child, shape),
          layoutItemMarginClasses(child).classes,
          layoutItemAlignSelfClass(child),
          layoutItemMinMaxClasses(child),
          layoutItemZIndexClass(child),
          layoutItemAbsoluteClasses(child),
        );
        const itemStyle = layoutItemMarginClasses(child).style;
        const childHtml = renderShape(child, objects, flexCtx);
        if (!itemClasses && !itemStyle) return childHtml;
        return tag(
          'div',
          { class: itemClasses || undefined, style: itemStyle || undefined },
          childHtml,
        );
      })
      .join('');
  } else if (isGrid) {
    const gridCtx: ConverterContext = { ...ctx, _forceRelative: true };
    inner = children
      .map((child) => {
        const cell = findCellForShape(shape, child.id);
        const cellClasses = cell ? gridCellClasses(cell) : '';
        const childHtml = renderShape(child, objects, gridCtx);
        if (!cellClasses) return childHtml;
        return tag('div', { class: cellClasses }, childHtml);
      })
      .join('');
  } else {
    const childCtx: ConverterContext = {
      ...ctx,
      _isCanvasTopLevel: false,
      _isChildOfRoot: isRoot,
      _forceRelative: false,
      _offsetX: shape.x ?? 0,
      _offsetY: shape.y ?? 0,
    };
    inner = children
      .map((child) => renderShape(child, objects, childCtx))
      .join('');
  }

  return tag(
    'div',
    {
      'data-id': shape.id,
      class: classes || undefined,
      style: style || undefined,
    },
    inner,
  );
}
