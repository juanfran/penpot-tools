import { describe, it, expect } from 'vitest';
import { blurToStyle } from './blur';
import type { Blur } from '../../penpot.types';

describe('blurToStyle', () => {
  it('returns empty string when blur is undefined', () => {
    expect(blurToStyle(undefined)).toBe('');
  });

  it('returns empty string when blur is hidden', () => {
    const blur: Blur = { type: 'layer-blur', value: 10, hidden: true };
    expect(blurToStyle(blur)).toBe('');
  });

  it('returns filter: blur(Npx) for layer-blur', () => {
    const blur: Blur = { type: 'layer-blur', value: 8, hidden: false };
    expect(blurToStyle(blur)).toBe('filter: blur(8px);');
  });

  it('returns backdrop-filter: blur(Npx) for background-blur', () => {
    const blur: Blur = { type: 'background-blur', value: 12, hidden: false };
    expect(blurToStyle(blur)).toBe('backdrop-filter: blur(12px);');
  });

  it('rounds value to 1 decimal place', () => {
    const blur: Blur = { type: 'layer-blur', value: 8.456, hidden: false };
    expect(blurToStyle(blur)).toBe('filter: blur(8.5px);');
  });

  it('omits decimal when value is a whole number', () => {
    const blur: Blur = { type: 'layer-blur', value: 10.0, hidden: false };
    expect(blurToStyle(blur)).toBe('filter: blur(10px);');
  });

  it('returns empty string when value is undefined', () => {
    const blur: Blur = { type: 'layer-blur', hidden: false };
    expect(blurToStyle(blur)).toBe('');
  });
});
