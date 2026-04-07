import type { Stroke } from '../../penpot.types';
import { hexOpacityToCss } from '../utils/color';
import { cls } from '../utils/tailwind';

const STROKE_STYLE_CLASS: Record<string, string> = {
  solid: 'border-solid',
  dashed: 'border-dashed',
  dotted: 'border-dotted',
};

/**
 * Converts a Penpot stroke to Tailwind border classes and/or inline box-shadow style.
 *
 * - `center` alignment (default): emits `border-[Npx] border-[color] border-style` classes.
 * - `inner` alignment: emits `box-shadow: inset 0 0 0 Npx color` inline style.
 * - `outer` alignment: emits `box-shadow: 0 0 0 Npx color` inline style.
 *
 * Returns `{ classes: '', style: '' }` when the stroke has no color or width.
 */
export function solidStrokeToClasses(stroke: Stroke): {
  classes: string;
  style: string;
} {
  if (!stroke.strokeColor && !stroke.strokeWidth) {
    return { classes: '', style: '' };
  }

  const color = stroke.strokeColor
    ? hexOpacityToCss(stroke.strokeColor, stroke.strokeOpacity)
    : 'transparent';
  const width = stroke.strokeWidth ?? 1;
  const alignment = stroke.strokeAlignment ?? 'center';

  if (alignment === 'inner' || alignment === 'outer') {
    const inset = alignment === 'inner' ? 'inset ' : '';
    return {
      classes: '',
      style: `box-shadow: ${inset}0 0 0 ${width}px ${color};`,
    };
  }

  // center alignment — use Tailwind border classes
  const tailwindColor = color.replace(/ /g, '_');
  const styleClass = stroke.strokeStyle
    ? STROKE_STYLE_CLASS[stroke.strokeStyle]
    : undefined;
  const classes = cls(
    `border-[${width}px]`,
    `border-[${tailwindColor}]`,
    styleClass,
  );

  return { classes, style: '' };
}

/**
 * Converts a Penpot stroke alignment to a CSS `box-shadow` inline style string.
 *
 * - `inner`: `box-shadow: inset 0 0 0 Npx color`
 * - `outer`: `box-shadow: 0 0 0 Npx color`
 * - `center` (default) or missing strokeColor: returns `''` (handled by CSS border)
 *
 * Use `hexOpacityToCss` for the color to support opacity.
 */
export function strokeAlignmentToStyle(stroke: Stroke): string {
  const alignment = stroke.strokeAlignment ?? 'center';
  if (alignment === 'center' || !stroke.strokeColor) return '';

  const color = hexOpacityToCss(stroke.strokeColor, stroke.strokeOpacity);
  const width = stroke.strokeWidth ?? 1;
  const inset = alignment === 'inner' ? 'inset ' : '';
  return `box-shadow: ${inset}0 0 0 ${width}px ${color};`;
}
