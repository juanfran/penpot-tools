import type { Shadow } from '../../penpot.types';
import { hexOpacityToCss } from '../utils/color';

export function shadowToStyle(shadow: Shadow): string {
  if (shadow.hidden) return '';

  const color = hexOpacityToCss(shadow.color.color, shadow.color.opacity);
  const { offsetX, offsetY, blur, spread } = shadow;
  const inset = shadow.style === 'inner-shadow' ? 'inset ' : '';

  return `${inset}${offsetX}px ${offsetY}px ${blur}px ${spread}px ${color}`;
}

export function shadowsToStyle(shadows: Shadow[] | undefined): string {
  if (!shadows || shadows.length === 0) return '';

  const values = shadows.map(shadowToStyle).filter(Boolean);
  if (values.length === 0) return '';

  return `box-shadow: ${values.join(', ')};`;
}
