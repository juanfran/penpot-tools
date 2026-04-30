import { describe, it, expect } from 'vitest';
import { extractInlinePx, parseColor, parseLengthOrPct, parseNumber, parsePx } from './css';

describe('parsePx', () => {
  it('parses integer px', () => {
    expect(parsePx('12px')).toBe(12);
  });

  it('parses fractional px', () => {
    expect(parsePx('1.5px')).toBe(1.5);
  });

  it('parses zero', () => {
    expect(parsePx('0px')).toBe(0);
  });

  it('parses negative px', () => {
    expect(parsePx('-4px')).toBe(-4);
  });

  it('returns null for unitless values', () => {
    expect(parsePx('12')).toBeNull();
  });

  it('returns null for non-px units', () => {
    expect(parsePx('1em')).toBeNull();
    expect(parsePx('50%')).toBeNull();
  });

  it('returns null for empty / undefined', () => {
    expect(parsePx('')).toBeNull();
  });
});

describe('parseNumber', () => {
  it('parses integers', () => {
    expect(parseNumber('1')).toBe(1);
  });

  it('parses fractionals', () => {
    expect(parseNumber('0.5')).toBe(0.5);
  });

  it('rejects values with units', () => {
    expect(parseNumber('1px')).toBeNull();
  });
});

describe('parseColor', () => {
  it('parses rgb() with commas', () => {
    expect(parseColor('rgb(255, 0, 0)')).toEqual({ hex: '#FF0000', opacity: 1 });
  });

  it('parses rgba() with commas', () => {
    expect(parseColor('rgba(255, 0, 0, 0.5)')).toEqual({ hex: '#FF0000', opacity: 0.5 });
  });

  it('parses rgb() with spaces (modern Chromium serialization)', () => {
    expect(parseColor('rgb(46 81 196)')).toEqual({ hex: '#2E51C4', opacity: 1 });
  });

  it('parses rgb() with space + slash alpha', () => {
    expect(parseColor('rgb(46 81 196 / 0.4)')).toEqual({ hex: '#2E51C4', opacity: 0.4 });
  });

  it('rounds fractional channels', () => {
    expect(parseColor('rgb(15.6, 23.4, 31.2)')).toEqual({ hex: '#10171F', opacity: 1 });
  });

  it('treats transparent as no color', () => {
    expect(parseColor('transparent')).toBeNull();
  });

  it('treats fully transparent rgba as opacity 0', () => {
    expect(parseColor('rgba(0, 0, 0, 0)')).toEqual({ hex: '#000000', opacity: 0 });
  });

  it('returns null for empty string', () => {
    expect(parseColor('')).toBeNull();
  });
});

describe('parseLengthOrPct', () => {
  it('parses px values like parsePx', () => {
    expect(parseLengthOrPct('12px', 100)).toBe(12);
    expect(parseLengthOrPct('1.5px', 100)).toBe(1.5);
    expect(parseLengthOrPct('-4px', 100)).toBe(-4);
  });

  it('resolves percentages against the supplied base', () => {
    expect(parseLengthOrPct('50%', 46)).toBe(23);
    expect(parseLengthOrPct('100%', 80)).toBe(80);
    expect(parseLengthOrPct('25%', 200)).toBe(50);
  });

  it('reads only the first value of an elliptic per-corner radius', () => {
    // `border-top-left-radius: 10px 20px` (rx=10, ry=20). Penpot stores a
    // scalar radius per corner, so we approximate with the first (rx).
    expect(parseLengthOrPct('10px 20px', 100)).toBe(10);
    expect(parseLengthOrPct('25% 50%', 80)).toBe(20);
  });

  it('returns null for unitless or non-length values', () => {
    expect(parseLengthOrPct('12', 100)).toBeNull();
    expect(parseLengthOrPct('1em', 100)).toBeNull();
    expect(parseLengthOrPct('', 100)).toBeNull();
  });
});

describe('extractInlinePx', () => {
  it('reads a px value at the start of the declaration', () => {
    expect(extractInlinePx('width:1px;height:36px', 'width')).toBe(1);
  });

  it('reads a px value after another declaration', () => {
    expect(extractInlinePx('display:flex; width:24px; gap:8px', 'width')).toBe(24);
  });

  it('reads fractional px', () => {
    expect(extractInlinePx('width:1.5px', 'width')).toBe(1.5);
  });

  it('does not match a sub-property (e.g. min-width when asking for width)', () => {
    expect(extractInlinePx('min-width:100px', 'width')).toBeNull();
  });

  it('returns null when the property is missing', () => {
    expect(extractInlinePx('height:10px', 'width')).toBeNull();
  });

  it('returns null for non-px values', () => {
    expect(extractInlinePx('width:50%', 'width')).toBeNull();
  });
});
