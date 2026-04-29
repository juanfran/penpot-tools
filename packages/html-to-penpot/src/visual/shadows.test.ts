import { describe, expect, it } from 'vitest';
import { parseSingleBoxShadow, shadowsFromBoxShadowList } from './shadows';

describe('parseSingleBoxShadow', () => {
  it('parses a Chrome computed-style entry (color first)', () => {
    // Chrome serializes `box-shadow: 0 4px 12px rgba(0,0,0,.4)` as
    // `rgba(0, 0, 0, 0.4) 0px 4px 12px 0px` (color at the START).
    const out = parseSingleBoxShadow('rgba(0, 0, 0, 0.4) 0px 4px 12px 0px');
    expect(out).not.toBeNull();
    expect(out!.offsetX).toBe(0);
    expect(out!.offsetY).toBe(4);
    expect(out!.blur).toBe(12);
    expect(out!.spread).toBe(0);
    expect(out!.style).toBe('drop-shadow');
    expect(out!.color.opacity).toBeCloseTo(0.4);
  });

  it('parses authored CSS (color last)', () => {
    const out = parseSingleBoxShadow('0px 4px 12px 0px rgba(0, 0, 0, 0.4)');
    expect(out).not.toBeNull();
    expect(out!.offsetY).toBe(4);
    expect(out!.blur).toBe(12);
  });

  it('preserves negative spread (soft contained shadows)', () => {
    // Common UI pattern: 0 30px 60px -20px rgba(...) — spread pulls the shadow
    // back so it doesn't bleed outward. Must round-trip with the negative value.
    const out = parseSingleBoxShadow('rgba(31, 26, 20, 0.35) 0px 30px 60px -20px');
    expect(out).not.toBeNull();
    expect(out!.spread).toBe(-20);
    expect(out!.offsetY).toBe(30);
    expect(out!.blur).toBe(60);
  });

  it('parses inset shadows', () => {
    const out = parseSingleBoxShadow('inset rgb(0, 0, 0) 0px 2px 4px 0px');
    expect(out).not.toBeNull();
    expect(out!.style).toBe('inner-shadow');
  });

  it('returns null for unparseable input', () => {
    expect(parseSingleBoxShadow('garbage')).toBeNull();
    expect(parseSingleBoxShadow('')).toBeNull();
  });
});

describe('shadowsFromBoxShadowList', () => {
  it('skips entries already consumed as outer strokes', () => {
    const entries = [
      'rgb(0, 0, 0) 0px 0px 0px 2px',
      'rgba(0, 0, 0, 0.4) 0px 4px 12px 0px',
    ];
    const consumed = new Set([0]);
    const shadows = shadowsFromBoxShadowList(entries, consumed);
    expect(shadows).toHaveLength(1);
    expect(shadows[0]!.blur).toBe(12);
  });
});
