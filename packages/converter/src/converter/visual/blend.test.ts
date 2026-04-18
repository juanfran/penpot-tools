import { describe, it, expect } from 'vitest';
import { blendModeToStyle, opacityToStyle, hiddenToStyle } from './blend';

describe('blendModeToStyle', () => {
  it('returns empty string for undefined', () => {
    expect(blendModeToStyle(undefined)).toBe('');
  });

  it('returns empty string for normal', () => {
    expect(blendModeToStyle('normal')).toBe('');
  });

  it('maps multiply', () => {
    expect(blendModeToStyle('multiply')).toBe('mix-blend-mode: multiply;');
  });

  it('maps screen', () => {
    expect(blendModeToStyle('screen')).toBe('mix-blend-mode: screen;');
  });

  it('maps overlay', () => {
    expect(blendModeToStyle('overlay')).toBe('mix-blend-mode: overlay;');
  });

  it('maps darken', () => {
    expect(blendModeToStyle('darken')).toBe('mix-blend-mode: darken;');
  });

  it('maps lighten', () => {
    expect(blendModeToStyle('lighten')).toBe('mix-blend-mode: lighten;');
  });

  it('maps color-dodge', () => {
    expect(blendModeToStyle('color-dodge')).toBe('mix-blend-mode: color-dodge;');
  });

  it('maps color-burn', () => {
    expect(blendModeToStyle('color-burn')).toBe('mix-blend-mode: color-burn;');
  });

  it('maps hard-light', () => {
    expect(blendModeToStyle('hard-light')).toBe('mix-blend-mode: hard-light;');
  });

  it('maps soft-light', () => {
    expect(blendModeToStyle('soft-light')).toBe('mix-blend-mode: soft-light;');
  });

  it('maps difference', () => {
    expect(blendModeToStyle('difference')).toBe('mix-blend-mode: difference;');
  });

  it('maps exclusion', () => {
    expect(blendModeToStyle('exclusion')).toBe('mix-blend-mode: exclusion;');
  });

  it('maps hue', () => {
    expect(blendModeToStyle('hue')).toBe('mix-blend-mode: hue;');
  });

  it('maps saturation', () => {
    expect(blendModeToStyle('saturation')).toBe('mix-blend-mode: saturation;');
  });

  it('maps color', () => {
    expect(blendModeToStyle('color')).toBe('mix-blend-mode: color;');
  });

  it('maps luminosity', () => {
    expect(blendModeToStyle('luminosity')).toBe('mix-blend-mode: luminosity;');
  });
});

describe('opacityToStyle', () => {
  it('returns empty string for undefined', () => {
    expect(opacityToStyle(undefined)).toBe('');
  });

  it('returns empty string for opacity 1', () => {
    expect(opacityToStyle(1)).toBe('');
  });

  it('returns opacity: 0.5 for 0.5', () => {
    expect(opacityToStyle(0.5)).toBe('opacity: 0.5;');
  });

  it('returns opacity: 0 for 0', () => {
    expect(opacityToStyle(0)).toBe('opacity: 0;');
  });

  it('returns opacity: 0.333 for 0.333', () => {
    expect(opacityToStyle(0.333)).toBe('opacity: 0.333;');
  });

  it('returns opacity: 0.75 for 0.75', () => {
    expect(opacityToStyle(0.75)).toBe('opacity: 0.75;');
  });
});

describe('hiddenToStyle', () => {
  it('returns display: none when hidden is true', () => {
    expect(hiddenToStyle(true)).toBe('display: none;');
  });

  it('returns empty string when hidden is false', () => {
    expect(hiddenToStyle(false)).toBe('');
  });

  it('returns empty string when hidden is undefined', () => {
    expect(hiddenToStyle(undefined)).toBe('');
  });
});
