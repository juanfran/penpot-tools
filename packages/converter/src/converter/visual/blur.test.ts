import { describe, it, expect } from 'vitest';
import { blurToClass } from './blur';
import type { Blur } from '../../penpot.types';

describe('blurToClass', () => {
  it('returns empty string when blur is undefined', () => {
    expect(blurToClass(undefined)).toBe('');
  });

  it('returns empty string when blur is hidden', () => {
    const blur: Blur = { type: 'layer-blur', value: 10, hidden: true };
    expect(blurToClass(blur)).toBe('');
  });

  it('returns blur-[Npx] for layer-blur', () => {
    const blur: Blur = { type: 'layer-blur', value: 8, hidden: false };
    expect(blurToClass(blur)).toBe('blur-[8px]');
  });

  it('returns backdrop-blur-[Npx] for background-blur', () => {
    const blur: Blur = { type: 'background-blur', value: 12, hidden: false };
    expect(blurToClass(blur)).toBe('backdrop-blur-[12px]');
  });

  it('rounds value to 1 decimal place', () => {
    const blur: Blur = { type: 'layer-blur', value: 8.456, hidden: false };
    expect(blurToClass(blur)).toBe('blur-[8.5px]');
  });

  it('omits decimal when value is a whole number', () => {
    const blur: Blur = { type: 'layer-blur', value: 10.0, hidden: false };
    expect(blurToClass(blur)).toBe('blur-[10px]');
  });

  it('returns empty string when value is undefined', () => {
    const blur: Blur = { type: 'layer-blur', hidden: false };
    expect(blurToClass(blur)).toBe('');
  });
});
