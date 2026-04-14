import type { BlendMode } from '../../penpot.types';

const BLEND_MODE_CLASS: Record<Exclude<BlendMode, 'normal'>, string> = {
  multiply: 'mix-blend-multiply',
  screen: 'mix-blend-screen',
  overlay: 'mix-blend-overlay',
  darken: 'mix-blend-darken',
  lighten: 'mix-blend-lighten',
  'color-dodge': 'mix-blend-color-dodge',
  'color-burn': 'mix-blend-color-burn',
  'hard-light': 'mix-blend-hard-light',
  'soft-light': 'mix-blend-soft-light',
  difference: 'mix-blend-difference',
  exclusion: 'mix-blend-exclusion',
  hue: 'mix-blend-hue',
  saturation: 'mix-blend-saturation',
  color: 'mix-blend-color',
  luminosity: 'mix-blend-luminosity',
};

/**
 * Converts a Penpot blend mode to a Tailwind `mix-blend-*` class.
 * Returns `''` for `'normal'` or `undefined` (browser default).
 */
export function blendModeToClass(mode: BlendMode | undefined): string {
  if (!mode || mode === 'normal') return '';
  return BLEND_MODE_CLASS[mode];
}

/**
 * Converts a Penpot opacity value to a Tailwind `opacity-[N%]` class.
 * Returns `''` for `undefined` or `1` (fully opaque).
 */
export function opacityToClass(opacity: number | undefined): string {
  if (opacity === undefined || opacity === 1) return '';
  const pct = Math.round(opacity * 100);
  return `opacity-[${pct}%]`;
}

/**
 * Returns `'hidden'` (Tailwind `display: none`) when `hidden === true`, otherwise `''`.
 * Hidden shapes are still emitted to the DOM to preserve structure.
 */
export function hiddenToClass(hidden: boolean | undefined): string {
  return hidden === true ? 'hidden' : '';
}
