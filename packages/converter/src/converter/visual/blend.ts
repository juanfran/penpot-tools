import type { BlendMode } from '../../penpot.types';

const BLEND_MODE_VALUE: Record<Exclude<BlendMode, 'normal'>, string> = {
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color-dodge': 'color-dodge',
  'color-burn': 'color-burn',
  'hard-light': 'hard-light',
  'soft-light': 'soft-light',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
};

export function blendModeToStyle(mode: BlendMode | undefined): string {
  if (!mode || mode === 'normal') return '';
  return `mix-blend-mode: ${BLEND_MODE_VALUE[mode]};`;
}

export function opacityToStyle(opacity: number | undefined): string {
  if (opacity === undefined || opacity === 1) return '';
  return `opacity: ${opacity};`;
}

export function hiddenToStyle(hidden: boolean | undefined): string {
  return hidden === true ? 'display: none;' : '';
}
