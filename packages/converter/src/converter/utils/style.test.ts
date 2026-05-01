import { describe, it, expect } from 'vitest';
import { mergeStyles } from './style';

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

  it('dedupes width/height with last-wins semantics', () => {
    expect(mergeStyles('width: 10px; height: 5px;', 'width: 20px;')).toBe(
      'height: 5px; width: 20px;',
    );
  });

  it('dedupes when the same property appears in a single part', () => {
    expect(mergeStyles('color: red; color: blue;')).toBe('color: blue;');
  });

  it('preserves insertion order of unique props alongside an override', () => {
    expect(
      mergeStyles('position: absolute;', 'left: 10px;', 'top: 20px;', 'left: 50px;'),
    ).toBe('position: absolute; top: 20px; left: 50px;');
  });

  it('property names are case-insensitive (CSS spec)', () => {
    expect(mergeStyles('WIDTH: 10px;', 'width: 20px;')).toBe('width: 20px;');
  });
});
