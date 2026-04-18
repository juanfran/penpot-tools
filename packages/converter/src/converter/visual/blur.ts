import type { Blur } from '../../penpot.types';

export function blurToStyle(blur: Blur | undefined): string {
  if (!blur || blur.hidden || blur.value === undefined) return '';

  const rounded = Math.round(blur.value * 10) / 10;
  const formatted = rounded % 1 === 0 ? String(rounded | 0) : rounded.toFixed(1);

  if (blur.type === 'background-blur') {
    return `backdrop-filter: blur(${formatted}px);`;
  }

  return `filter: blur(${formatted}px);`;
}
