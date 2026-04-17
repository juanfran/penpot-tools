import type { Stroke } from '../../penpot.types';
import { hexOpacityToCss } from '../utils/color';
import { cls } from '../utils/tailwind';
import { tokenToCssVarName } from '../tokens';

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
export function solidStrokeToClasses(
  stroke: Stroke,
  strokeTokenName?: string,
): {
  classes: string;
  style: string;
} {
  if (!stroke.strokeColor && !stroke.strokeWidth) {
    return { classes: '', style: '' };
  }

  const rawColor = stroke.strokeColor
    ? hexOpacityToCss(stroke.strokeColor, stroke.strokeOpacity)
    : 'transparent';
  // When a token name is provided, use the CSS variable instead of the raw color
  const color = strokeTokenName ? `var(--${tokenToCssVarName(strokeTokenName)})` : rawColor;
  const width = stroke.strokeWidth ?? 1;
  const alignment = stroke.strokeAlignment ?? 'center';

  if (alignment === 'outer') {
    const tailwindValue = `0_0_0_${width}px_${color.replace(/ /g, '_')}`;
    return { classes: `shadow-[${tailwindValue}]`, style: '' };
  }

  // inner and center alignment — use Tailwind border classes.
  // With box-sizing: border-box (Tailwind default), border is drawn inside
  // the element's dimensions, matching Penpot's inner stroke behaviour.
  const tailwindColor = color.replace(/ /g, '_');
  const styleClass = stroke.strokeStyle ? STROKE_STYLE_CLASS[stroke.strokeStyle] : undefined;
  const classes = cls(`border-[${width}px]`, `border-[${tailwindColor}]`, styleClass);

  return { classes, style: '' };
}
