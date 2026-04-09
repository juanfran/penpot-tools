import type { Shadow } from '../../penpot.types';
import { hexOpacityToCss } from '../utils/color';

/**
 * Converts a single Penpot shadow to a CSS box-shadow value string (without the property name).
 *
 * Returns `''` if the shadow is hidden.
 * Prefixes with `inset ` for `'inner-shadow'` style.
 */
export function shadowToStyle(shadow: Shadow): string {
  if (shadow.hidden) return '';

  const color = hexOpacityToCss(shadow.color.color, shadow.color.opacity);
  const { offsetX, offsetY, blur, spread } = shadow;
  const inset = shadow.style === 'inner-shadow' ? 'inset ' : '';

  return `${inset}${offsetX}px ${offsetY}px ${blur}px ${spread}px ${color}`;
}

/**
 * Converts an array of Penpot shadows to a single Tailwind `shadow-[...]` arbitrary class.
 *
 * Hidden shadows are skipped. Multiple shadows are joined with `,` inside the brackets.
 * Spaces in the value are replaced with underscores per Tailwind arbitrary-value syntax.
 * Returns `''` when there are no visible shadows.
 */
export function shadowsToClass(shadows: Shadow[] | undefined): string {
  if (!shadows || shadows.length === 0) return '';

  const values = shadows.map(shadowToStyle).filter(Boolean);
  if (values.length === 0) return '';

  const tailwindValue = values.join(', ').replace(/ /g, '_');
  return `shadow-[${tailwindValue}]`;
}
