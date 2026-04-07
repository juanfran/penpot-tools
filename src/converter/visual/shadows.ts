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
 * Converts an array of Penpot shadows to a single `box-shadow` CSS property string.
 *
 * Hidden shadows are skipped. Multiple shadows are joined with `, `.
 * Returns `''` when there are no visible shadows.
 */
export function shadowsToStyle(shadows: Shadow[] | undefined): string {
  if (!shadows || shadows.length === 0) return '';

  const values = shadows.map(shadowToStyle).filter(Boolean);
  if (values.length === 0) return '';

  return `box-shadow: ${values.join(', ')};`;
}
