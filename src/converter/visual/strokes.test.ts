import { describe, it, expect } from 'vitest';
import { solidStrokeToClasses, strokeAlignmentToStyle } from './strokes';
import type { Stroke, HexColor } from '../../penpot.types';

describe('solidStrokeToClasses', () => {
  it('returns empty classes and style when stroke has no color or width', () => {
    const stroke: Stroke = {};
    const result = solidStrokeToClasses(stroke);
    expect(result.classes).toBe('');
    expect(result.style).toBe('');
  });

  it('returns border width class for center-aligned stroke', () => {
    const stroke: Stroke = {
      strokeColor: '#ff0000' as HexColor,
      strokeWidth: 2,
      strokeAlignment: 'center',
    };
    const result = solidStrokeToClasses(stroke);
    expect(result.classes).toContain('border-[2px]');
    expect(result.classes).toContain('border-[#ff0000]');
    expect(result.style).toBe('');
  });

  it('defaults to center alignment when strokeAlignment is undefined', () => {
    const stroke: Stroke = {
      strokeColor: '#000000' as HexColor,
      strokeWidth: 1,
    };
    const result = solidStrokeToClasses(stroke);
    expect(result.classes).toContain('border-[1px]');
    expect(result.classes).toContain('border-[#000000]');
    expect(result.style).toBe('');
  });

  it('maps strokeStyle solid to border-solid class', () => {
    const stroke: Stroke = {
      strokeColor: '#000000' as HexColor,
      strokeWidth: 1,
      strokeStyle: 'solid',
    };
    const result = solidStrokeToClasses(stroke);
    expect(result.classes).toContain('border-solid');
  });

  it('maps strokeStyle dashed to border-dashed class', () => {
    const stroke: Stroke = {
      strokeColor: '#000000' as HexColor,
      strokeWidth: 1,
      strokeStyle: 'dashed',
    };
    const result = solidStrokeToClasses(stroke);
    expect(result.classes).toContain('border-dashed');
  });

  it('maps strokeStyle dotted to border-dotted class', () => {
    const stroke: Stroke = {
      strokeColor: '#000000' as HexColor,
      strokeWidth: 1,
      strokeStyle: 'dotted',
    };
    const result = solidStrokeToClasses(stroke);
    expect(result.classes).toContain('border-dotted');
  });

  it('uses rgba color when strokeOpacity is present', () => {
    const stroke: Stroke = {
      strokeColor: '#ff0000' as HexColor,
      strokeOpacity: 0.5,
      strokeWidth: 2,
      strokeAlignment: 'center',
    };
    const result = solidStrokeToClasses(stroke);
    expect(result.classes).toContain('border-[rgba(255,_0,_0,_0.5)]');
    expect(result.style).toBe('');
  });

  it('uses inset box-shadow for inner alignment', () => {
    const stroke: Stroke = {
      strokeColor: '#ff0000' as HexColor,
      strokeWidth: 3,
      strokeAlignment: 'inner',
    };
    const result = solidStrokeToClasses(stroke);
    expect(result.classes).toBe('');
    expect(result.style).toBe('box-shadow: inset 0 0 0 3px #ff0000;');
  });

  it('uses outer box-shadow for outer alignment', () => {
    const stroke: Stroke = {
      strokeColor: '#ff0000' as HexColor,
      strokeWidth: 3,
      strokeAlignment: 'outer',
    };
    const result = solidStrokeToClasses(stroke);
    expect(result.classes).toBe('');
    expect(result.style).toBe('box-shadow: 0 0 0 3px #ff0000;');
  });

  it('uses rgba in box-shadow when opacity is set for inner alignment', () => {
    const stroke: Stroke = {
      strokeColor: '#ff0000' as HexColor,
      strokeOpacity: 0.5,
      strokeWidth: 2,
      strokeAlignment: 'inner',
    };
    const result = solidStrokeToClasses(stroke);
    expect(result.style).toContain('inset 0 0 0 2px rgba(255, 0, 0, 0.5)');
  });
});

describe('strokeAlignmentToStyle', () => {
  it('returns empty string for center alignment', () => {
    const stroke: Stroke = {
      strokeColor: '#ff0000' as HexColor,
      strokeWidth: 2,
      strokeAlignment: 'center',
    };
    expect(strokeAlignmentToStyle(stroke)).toBe('');
  });

  it('returns empty string when strokeAlignment is undefined', () => {
    const stroke: Stroke = {
      strokeColor: '#ff0000' as HexColor,
      strokeWidth: 2,
    };
    expect(strokeAlignmentToStyle(stroke)).toBe('');
  });

  it('returns inset box-shadow for inner alignment', () => {
    const stroke: Stroke = {
      strokeColor: '#0000ff' as HexColor,
      strokeWidth: 4,
      strokeAlignment: 'inner',
    };
    expect(strokeAlignmentToStyle(stroke)).toBe(
      'box-shadow: inset 0 0 0 4px #0000ff;',
    );
  });

  it('returns outer box-shadow for outer alignment', () => {
    const stroke: Stroke = {
      strokeColor: '#0000ff' as HexColor,
      strokeWidth: 4,
      strokeAlignment: 'outer',
    };
    expect(strokeAlignmentToStyle(stroke)).toBe(
      'box-shadow: 0 0 0 4px #0000ff;',
    );
  });

  it('uses rgba color when strokeOpacity is set', () => {
    const stroke: Stroke = {
      strokeColor: '#ff0000' as HexColor,
      strokeOpacity: 0.5,
      strokeWidth: 3,
      strokeAlignment: 'outer',
    };
    expect(strokeAlignmentToStyle(stroke)).toBe(
      'box-shadow: 0 0 0 3px rgba(255, 0, 0, 0.5);',
    );
  });

  it('returns empty string when no strokeColor is present', () => {
    const stroke: Stroke = { strokeWidth: 2, strokeAlignment: 'inner' };
    expect(strokeAlignmentToStyle(stroke)).toBe('');
  });
});
