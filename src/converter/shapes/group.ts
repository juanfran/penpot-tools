import type { GroupShape, PathShape, Shape } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { tag } from '../utils/html';
import { cls } from '../utils/tailwind';
import { mergeStyles } from '../utils/style';
import {
  absolutePositionClasses,
  relativePositionClasses,
} from '../visual/position';
import { baseClasses } from '../visual/base';
import { hexOpacityToCss } from '../utils/color';
import { renderShape } from './dispatch';

/**
 * Returns true when any child is an SVG-imported path (x/y are null).
 * These shapes cannot be positioned with CSS and must be embedded in an SVG viewBox.
 */
function hasSvgPaths(children: Shape[]): boolean {
  return children.some((c) => c.type === 'path' && c.x == null);
}

/**
 * Renders a single path child as an SVG `<path>` element for embedding inside
 * an SVG group. Uses `svgAttrs` from the raw data for fill-rule / clip-rule.
 */
function renderPathElement(shape: PathShape): string {
  const fills = shape.fills ?? [];
  const firstFill = fills[0];
  const fillAttr = firstFill?.fillColor
    ? hexOpacityToCss(firstFill.fillColor, firstFill.fillOpacity ?? 1)
    : 'none';

  const svgAttrs =
    ((shape as unknown as Record<string, unknown>).svgAttrs as Record<
      string,
      string
    > | undefined) ?? {};

  return tag('path', {
    d: shape.content,
    fill: fillAttr,
    'fill-rule': svgAttrs['fillRule'],
    'clip-rule': svgAttrs['clipRule'],
  });
}

/**
 * Renders a group whose children include SVG-imported paths as a single
 * `<svg>` element. The viewBox maps page-absolute coordinates to the group's
 * display size so that paths with absolute coordinates render correctly.
 */
function renderGroupAsSvg(
  shape: GroupShape,
  children: Shape[],
  ctx: ConverterContext,
): string {
  const vx = shape.x;
  const vy = shape.y;
  const vw = shape.width;
  const vh = shape.height;

  const base = baseClasses(shape, ctx);
  const posClass = ctx._parentIsLayout
    ? undefined
    : ctx._forceRelative
      ? relativePositionClasses(shape)
      : absolutePositionClasses(shape, ctx._isChildOfRoot);

  const classes = cls(posClass, base.classes);
  const style = mergeStyles(base.style);

  const inner = children
    .filter((c) => !c.hidden)
    .map((c) => (c.type === 'path' ? renderPathElement(c as PathShape) : ''))
    .filter(Boolean)
    .join('');

  return tag(
    'svg',
    {
      'data-id': shape.id,
      width: String(vw),
      height: String(vh),
      viewBox: `${vx} ${vy} ${vw} ${vh}`,
      xmlns: 'http://www.w3.org/2000/svg',
      fill: 'none',
      class: classes || undefined,
      style: style || undefined,
    },
    inner,
  );
}

/**
 * Renders a Penpot `GroupShape` as an absolutely-positioned `<div>` container.
 *
 * The group itself has no background; it provides a coordinate space for children.
 * Each child is recursively rendered via `renderShape`.
 *
 * If `shape.maskedGroup === true`, `overflow-hidden` is added so the first child
 * acts as a visual clip mask (simplified CSS approximation).
 *
 * The `data-id` attribute carries the Penpot shape ID.
 */
export function renderGroup(
  shape: GroupShape,
  children: Shape[],
  objects: Record<string, Shape>,
  ctx: ConverterContext,
): string {
  if (hasSvgPaths(children)) {
    return renderGroupAsSvg(shape, children, ctx);
  }

  const base = baseClasses(shape, ctx);
  const maskClass = shape.maskedGroup ? 'overflow-hidden' : undefined;

  const classes = cls(
    ctx._parentIsLayout
      ? undefined
      : ctx._forceRelative
        ? relativePositionClasses(shape)
        : absolutePositionClasses(shape, ctx._isChildOfRoot),
    base.classes,
    maskClass,
  );
  const style = mergeStyles(base.style);

  const inner = children
    .map((child) => renderShape(child, objects, ctx))
    .join('');

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
