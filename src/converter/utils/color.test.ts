import { describe, it, expect } from 'vitest';
import { hexOpacityToCss } from './color';
import type { HexColor } from '../../penpot.types';

const hex6 = '#ff0000' as HexColor;
const hex3 = '#f00' as HexColor;
const hexWithAlpha = '#aabbcc' as HexColor;

describe('hexOpacityToCss', () => {
  it('returns the hex string as-is when opacity is undefined', () => {
    expect(hexOpacityToCss(hex6)).toBe('#ff0000');
  });

  it('returns the hex string as-is when opacity is 1', () => {
    expect(hexOpacityToCss(hex6, 1)).toBe('#ff0000');
  });

  it('converts 6-digit hex + opacity to rgba()', () => {
    expect(hexOpacityToCss(hex6, 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('converts 3-digit hex + opacity to rgba()', () => {
    expect(hexOpacityToCss(hex3, 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('handles opacity 0', () => {
    expect(hexOpacityToCss(hex6, 0)).toBe('rgba(255, 0, 0, 0)');
  });

  it('handles mixed-channel 6-digit hex correctly', () => {
    expect(hexOpacityToCss(hexWithAlpha, 0.8)).toBe('rgba(170, 187, 204, 0.8)');
  });

  it('handles uppercase hex digits', () => {
    const upper = '#FF0000' as HexColor;
    expect(hexOpacityToCss(upper, 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });
});
