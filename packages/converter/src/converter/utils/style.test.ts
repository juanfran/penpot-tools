import { describe, it, expect } from 'vitest';
import { buildStyle, mergeStyles } from './style';

describe('buildStyle', () => {
  it('builds a style string from a simple object', () => {
    expect(buildStyle({ position: 'absolute', left: '10px', top: '20px' })).toBe(
      'position: absolute; left: 10px; top: 20px;',
    );
  });

  it('converts camelCase keys to kebab-case', () => {
    expect(buildStyle({ backgroundColor: '#ff0000' })).toBe('background-color: #ff0000;');
    expect(buildStyle({ fontSize: '16px' })).toBe('font-size: 16px;');
    expect(buildStyle({ borderTopLeftRadius: '4px' })).toBe('border-top-left-radius: 4px;');
  });

  it('skips undefined values', () => {
    expect(buildStyle({ left: '10px', top: undefined })).toBe('left: 10px;');
  });

  it('skips null values', () => {
    expect(buildStyle({ left: '10px', top: null })).toBe('left: 10px;');
  });

  it('skips empty string values', () => {
    expect(buildStyle({ left: '10px', top: '' })).toBe('left: 10px;');
  });

  it('includes numeric zero values', () => {
    expect(buildStyle({ left: 0, top: 0 })).toBe('left: 0; top: 0;');
  });

  it('includes non-zero numeric values', () => {
    expect(buildStyle({ width: 120, height: 80 })).toBe('width: 120; height: 80;');
  });

  it('returns empty string for empty object', () => {
    expect(buildStyle({})).toBe('');
  });

  it('returns empty string when all values are skipped', () => {
    expect(buildStyle({ left: null, top: undefined, right: '' })).toBe('');
  });
});

describe('mergeStyles', () => {
  it('joins two style strings', () => {
    expect(mergeStyles('left: 10px;', 'top: 20px;')).toBe('left: 10px; top: 20px;');
  });

  it('handles trailing semicolons and spacing correctly', () => {
    expect(mergeStyles('left: 10px; ', ' top: 20px;')).toBe('left: 10px; top: 20px;');
  });

  it('skips empty parts', () => {
    expect(mergeStyles('left: 10px;', '', 'top: 20px;')).toBe('left: 10px; top: 20px;');
  });

  it('returns empty string when all parts are empty', () => {
    expect(mergeStyles('', '', '')).toBe('');
  });

  it('handles a single part', () => {
    expect(mergeStyles('position: absolute;')).toBe('position: absolute;');
  });

  it('handles no parts', () => {
    expect(mergeStyles()).toBe('');
  });

  it('merges two box-shadow declarations into a comma-separated value', () => {
    expect(mergeStyles('box-shadow: 0 2px 4px #000;', 'box-shadow: inset 0 0 0 2px red;')).toBe(
      'box-shadow: 0 2px 4px #000, inset 0 0 0 2px red;',
    );
  });

  it('merges two transform declarations into a space-separated value', () => {
    expect(mergeStyles('transform: translate(10px, 20px);', 'transform: rotate(45deg);')).toBe(
      'transform: translate(10px, 20px) rotate(45deg);',
    );
  });

  it('merges three transform declarations preserving order', () => {
    expect(
      mergeStyles(
        'transform: translate(100px, 50px);',
        'transform: rotate(-30deg);',
        'transform: matrix(1, 0, 0, 1, 0, 0);',
      ),
    ).toBe('transform: translate(100px, 50px) rotate(-30deg) matrix(1, 0, 0, 1, 0, 0);');
  });

  it('keeps other properties alongside merged transform', () => {
    expect(
      mergeStyles('left: 0px;', 'transform: translate(10px, 20px);', 'transform: rotate(45deg);'),
    ).toBe('left: 0px; transform: translate(10px, 20px) rotate(45deg);');
  });
});
