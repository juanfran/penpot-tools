import { describe, it, expect } from 'vitest';
import { px } from './css';

describe('px', () => {
  it('returns integer pixel string for whole numbers', () => {
    expect(px(120)).toBe('120px');
  });

  it('returns decimal pixel string for fractional values', () => {
    expect(px(12.5)).toBe('12.5px');
  });

  it('rounds to 2 decimal places', () => {
    expect(px(12.345)).toBe('12.35px');
  });

  it('omits trailing zeros after rounding', () => {
    expect(px(12.1)).toBe('12.1px');
  });

  it('handles zero', () => {
    expect(px(0)).toBe('0px');
  });

  it('handles negative values', () => {
    expect(px(-10)).toBe('-10px');
  });

  it('handles values that round to whole numbers', () => {
    expect(px(12.004)).toBe('12px');
  });
});
