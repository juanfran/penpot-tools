import { describe, it, expect } from 'vitest';
import { px, pxClass, cls } from './tailwind';

describe('px', () => {
  it('returns an integer pixel token for whole numbers', () => {
    expect(px(120)).toBe('[120px]');
  });

  it('returns a decimal pixel token for fractional values', () => {
    expect(px(12.5)).toBe('[12.5px]');
  });

  it('rounds to 2 decimal places', () => {
    expect(px(12.345)).toBe('[12.35px]');
  });

  it('omits trailing zeros after rounding', () => {
    expect(px(12.1)).toBe('[12.1px]');
  });

  it('handles zero', () => {
    expect(px(0)).toBe('[0px]');
  });

  it('handles negative values', () => {
    expect(px(-10)).toBe('[-10px]');
  });

  it('handles values that round to whole numbers', () => {
    expect(px(12.004)).toBe('[12px]');
  });
});

describe('pxClass', () => {
  it('builds a Tailwind class with integer value', () => {
    expect(pxClass('w', 120)).toBe('w-[120px]');
  });

  it('builds a Tailwind class with fractional value', () => {
    expect(pxClass('h', 45.5)).toBe('h-[45.5px]');
  });

  it('works with any prefix', () => {
    expect(pxClass('left', 0)).toBe('left-[0px]');
    expect(pxClass('top', 32)).toBe('top-[32px]');
  });
});

describe('cls', () => {
  it('joins truthy string tokens with a space', () => {
    expect(cls('flex', 'items-center')).toBe('flex items-center');
  });

  it('filters out false values', () => {
    expect(cls('flex', false, 'items-center')).toBe('flex items-center');
  });

  it('filters out undefined values', () => {
    expect(cls('flex', undefined, 'items-center')).toBe('flex items-center');
  });

  it('filters out null values', () => {
    expect(cls('flex', null, 'items-center')).toBe('flex items-center');
  });

  it('filters out empty strings', () => {
    expect(cls('flex', '', 'items-center')).toBe('flex items-center');
  });

  it('returns empty string when all tokens are falsy', () => {
    expect(cls(false, undefined, null, '')).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cls()).toBe('');
  });

  it('returns a single token unchanged', () => {
    expect(cls('flex')).toBe('flex');
  });

  it('handles mixed truthy and falsy tokens', () => {
    expect(cls('a', false, 'b', null, 'c', undefined)).toBe('a b c');
  });
});
