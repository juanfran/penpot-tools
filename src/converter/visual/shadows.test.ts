import { describe, it, expect } from 'vitest';
import { shadowToStyle, shadowsToClass } from './shadows';
import type { Shadow, HexColor } from '../../penpot.types';

const makeShadow = (overrides: Partial<Shadow> = {}): Shadow => ({
  id: null,
  style: 'drop-shadow',
  offsetX: 0,
  offsetY: 0,
  blur: 0,
  spread: 0,
  hidden: false,
  color: { color: '#000000' as HexColor, opacity: 1 },
  ...overrides,
});

describe('shadowToStyle', () => {
  it('returns empty string for hidden shadow', () => {
    const shadow = makeShadow({ hidden: true });
    expect(shadowToStyle(shadow)).toBe('');
  });

  it('produces box-shadow value for drop-shadow', () => {
    const shadow = makeShadow({
      style: 'drop-shadow',
      offsetX: 2,
      offsetY: 4,
      blur: 6,
      spread: 0,
      color: { color: '#ff0000' as HexColor, opacity: 1 },
    });
    expect(shadowToStyle(shadow)).toBe('2px 4px 6px 0px #ff0000');
  });

  it('prefixes with inset for inner-shadow', () => {
    const shadow = makeShadow({
      style: 'inner-shadow',
      offsetX: 1,
      offsetY: 2,
      blur: 3,
      spread: 4,
      color: { color: '#0000ff' as HexColor, opacity: 1 },
    });
    expect(shadowToStyle(shadow)).toBe('inset 1px 2px 3px 4px #0000ff');
  });

  it('uses rgba when opacity is not 1', () => {
    const shadow = makeShadow({
      offsetX: 0,
      offsetY: 4,
      blur: 8,
      spread: 0,
      color: { color: '#000000' as HexColor, opacity: 0.5 },
    });
    expect(shadowToStyle(shadow)).toBe('0px 4px 8px 0px rgba(0, 0, 0, 0.5)');
  });

  it('includes spread in the output', () => {
    const shadow = makeShadow({ spread: 5 });
    expect(shadowToStyle(shadow)).toContain('5px');
  });
});

describe('shadowsToClass', () => {
  it('returns empty string for no shadows', () => {
    expect(shadowsToClass([])).toBe('');
    expect(shadowsToClass(undefined)).toBe('');
  });

  it('returns a Tailwind shadow-[...] class for one shadow', () => {
    const shadows = [
      makeShadow({ offsetX: 2, offsetY: 4, blur: 6, spread: 0 }),
    ];
    expect(shadowsToClass(shadows)).toBe('shadow-[2px_4px_6px_0px_#000000]');
  });

  it('joins multiple shadows with comma inside brackets', () => {
    const shadows = [
      makeShadow({
        offsetX: 1,
        offsetY: 2,
        blur: 3,
        spread: 0,
        color: { color: '#ff0000' as HexColor, opacity: 1 },
      }),
      makeShadow({
        offsetX: 4,
        offsetY: 5,
        blur: 6,
        spread: 0,
        color: { color: '#0000ff' as HexColor, opacity: 1 },
      }),
    ];
    expect(shadowsToClass(shadows)).toBe(
      'shadow-[1px_2px_3px_0px_#ff0000,_4px_5px_6px_0px_#0000ff]',
    );
  });

  it('skips hidden shadows', () => {
    const shadows = [
      makeShadow({
        hidden: true,
        color: { color: '#ff0000' as HexColor, opacity: 1 },
      }),
      makeShadow({ offsetX: 2, offsetY: 4, blur: 6, spread: 0 }),
    ];
    expect(shadowsToClass(shadows)).toBe('shadow-[2px_4px_6px_0px_#000000]');
  });

  it('returns empty string when all shadows are hidden', () => {
    const shadows = [makeShadow({ hidden: true })];
    expect(shadowsToClass(shadows)).toBe('');
  });
});
