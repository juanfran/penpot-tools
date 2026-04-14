import { describe, it, expect } from 'vitest';
import { blendModeToClass, opacityToClass, hiddenToClass } from './blend';

describe('blendModeToClass', () => {
  it('returns empty string for undefined', () => {
    expect(blendModeToClass(undefined)).toBe('');
  });

  it('returns empty string for normal', () => {
    expect(blendModeToClass('normal')).toBe('');
  });

  it('maps multiply to mix-blend-multiply', () => {
    expect(blendModeToClass('multiply')).toBe('mix-blend-multiply');
  });

  it('maps screen to mix-blend-screen', () => {
    expect(blendModeToClass('screen')).toBe('mix-blend-screen');
  });

  it('maps overlay to mix-blend-overlay', () => {
    expect(blendModeToClass('overlay')).toBe('mix-blend-overlay');
  });

  it('maps darken to mix-blend-darken', () => {
    expect(blendModeToClass('darken')).toBe('mix-blend-darken');
  });

  it('maps lighten to mix-blend-lighten', () => {
    expect(blendModeToClass('lighten')).toBe('mix-blend-lighten');
  });

  it('maps color-dodge to mix-blend-color-dodge', () => {
    expect(blendModeToClass('color-dodge')).toBe('mix-blend-color-dodge');
  });

  it('maps color-burn to mix-blend-color-burn', () => {
    expect(blendModeToClass('color-burn')).toBe('mix-blend-color-burn');
  });

  it('maps hard-light to mix-blend-hard-light', () => {
    expect(blendModeToClass('hard-light')).toBe('mix-blend-hard-light');
  });

  it('maps soft-light to mix-blend-soft-light', () => {
    expect(blendModeToClass('soft-light')).toBe('mix-blend-soft-light');
  });

  it('maps difference to mix-blend-difference', () => {
    expect(blendModeToClass('difference')).toBe('mix-blend-difference');
  });

  it('maps exclusion to mix-blend-exclusion', () => {
    expect(blendModeToClass('exclusion')).toBe('mix-blend-exclusion');
  });

  it('maps hue to mix-blend-hue', () => {
    expect(blendModeToClass('hue')).toBe('mix-blend-hue');
  });

  it('maps saturation to mix-blend-saturation', () => {
    expect(blendModeToClass('saturation')).toBe('mix-blend-saturation');
  });

  it('maps color to mix-blend-color', () => {
    expect(blendModeToClass('color')).toBe('mix-blend-color');
  });

  it('maps luminosity to mix-blend-luminosity', () => {
    expect(blendModeToClass('luminosity')).toBe('mix-blend-luminosity');
  });
});

describe('opacityToClass', () => {
  it('returns empty string for undefined', () => {
    expect(opacityToClass(undefined)).toBe('');
  });

  it('returns empty string for opacity 1', () => {
    expect(opacityToClass(1)).toBe('');
  });

  it('returns opacity-[50%] for 0.5', () => {
    expect(opacityToClass(0.5)).toBe('opacity-[50%]');
  });

  it('returns opacity-[0%] for 0', () => {
    expect(opacityToClass(0)).toBe('opacity-[0%]');
  });

  it('rounds to nearest integer', () => {
    expect(opacityToClass(0.333)).toBe('opacity-[33%]');
  });

  it('returns opacity-[75%] for 0.75', () => {
    expect(opacityToClass(0.75)).toBe('opacity-[75%]');
  });
});

describe('hiddenToClass', () => {
  it('returns hidden when hidden is true', () => {
    expect(hiddenToClass(true)).toBe('hidden');
  });

  it('returns empty string when hidden is false', () => {
    expect(hiddenToClass(false)).toBe('');
  });

  it('returns empty string when hidden is undefined', () => {
    expect(hiddenToClass(undefined)).toBe('');
  });
});
