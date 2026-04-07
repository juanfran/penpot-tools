import type { FrameShape, Shape } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { tag } from '../utils/html';
import { cls } from '../utils/tailwind';
import { mergeStyles } from '../utils/style';
import { pxClass } from '../utils/tailwind';
import { baseClasses } from '../visual/base';
import { fillsToOutput } from '../visual/fills';
import {
  absolutePositionClasses,
  relativePositionClasses,
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
  gridTracksToStyle,
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
  const clipClass = shape.clipContent ? 'overflow-hidden' : undefined;

  let positionClasses: string;
  if (isRoot) {
    positionClasses = cls(
      'relative',
      pxClass('w', shape.width),
      pxClass('h', shape.height),
    );
  } else if (ctx._parentIsLayout) {
    positionClasses = '';
  } else if (ctx._forceRelative) {
    positionClasses = relativePositionClasses(shape);
  } else {
    positionClasses = absolutePositionClasses(shape, ctx._isChildOfRoot);
  }

  let layoutClasses = '';
  let layoutStyle = '';
  if (isFlex) {
    layoutClasses = flexContainerClasses(shape);
    const spacing = flexSpacingClasses(shape);
    layoutClasses = cls(layoutClasses, spacing.classes);
    layoutStyle = spacing.style;
  } else if (isGrid) {
    layoutClasses = 'grid';
    const colStyle = gridTracksToStyle(
      shape.layoutGridColumns ?? [],
      'columns',
    );
    const rowStyle = gridTracksToStyle(shape.layoutGridRows ?? [], 'rows');
    layoutStyle = mergeStyles(colStyle, rowStyle);
  }

  const bgClass =
    isRoot && ctx._pageBackground ? `bg-[${ctx._pageBackground}]` : undefined;

  const classes = cls(
    positionClasses,
    layoutClasses,
    base.classes,
    fills.classes,
    clipClass,
    bgClass,
  );
  const style = mergeStyles(layoutStyle, base.style, fills.style);

  let inner: string;
  if (isFlex) {
    const flexCtx: ConverterContext = { ...ctx, _parentIsLayout: true };
    inner = children
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
    const gridCtx: ConverterContext = { ...ctx, _parentIsLayout: true };
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
      _isChildOfRoot: isRoot,
      _forceRelative: false,
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
