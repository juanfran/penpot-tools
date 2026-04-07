import type { Blur } from '../../penpot.types';

/**
 * Converts a Penpot blur to a Tailwind filter class.
 *
 * - `layer-blur` → `blur-[Npx]`
 * - `background-blur` → `backdrop-blur-[Npx]`
 * - Hidden or missing blur → `''`
 *
 * Value is rounded to 1 decimal place; trailing `.0` is omitted.
 */
export function blurToClass(blur: Blur | undefined): string {
  if (!blur || blur.hidden || blur.value === undefined) return '';

  const rounded = Math.round(blur.value * 10) / 10;
  const formatted =
    rounded % 1 === 0 ? String(rounded | 0) : rounded.toFixed(1);

  if (blur.type === 'background-blur') {
    return `backdrop-blur-[${formatted}px]`;
  }

  return `blur-[${formatted}px]`;
}
