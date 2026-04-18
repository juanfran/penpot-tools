import { describe, it, expect } from 'vitest';
import { solidStrokeToStyle } from './strokes';
import type { Stroke, HexColor } from '../../penpot.types';

describe('solidStrokeToStyle', () => {
  it('returns empty string when stroke has no color or width', () => {
    expect(solidStrokeToStyle({})).toBe('');
  });

  it('returns border style for center-aligned stroke', () => {
    const stroke: Stroke = {
      strokeColor: '#ff0000' as HexColor,
      strokeWidth: 2,
      strokeAlignment: 'center',
    };
    const result = solidStrokeToStyle(stroke);
    expect(result).toContain('border:');
    expect(result).toContain('2px');
    expect(result).toContain('#ff0000');
  });

  it('defaults to center alignment when strokeAlignment is undefined', () => {
    const stroke: Stroke = { strokeColor: '#000000' as HexColor, strokeWidth: 1 };
    const result = solidStrokeToStyle(stroke);
    expect(result).toContain('border:');
    expect(result).toContain('1px');
    expect(result).toContain('#000000');
  });

  it('maps strokeStyle solid to solid border-style', () => {
    const stroke: Stroke = { strokeColor: '#000000' as HexColor, strokeWidth: 1, strokeStyle: 'solid' };
    expect(solidStrokeToStyle(stroke)).toContain('solid');
  });

  it('maps strokeStyle dashed to dashed border-style', () => {
    const stroke: Stroke = { strokeColor: '#000000' as HexColor, strokeWidth: 1, strokeStyle: 'dashed' };
    expect(solidStrokeToStyle(stroke)).toContain('dashed');
  });

  it('maps strokeStyle dotted to dotted border-style', () => {
    const stroke: Stroke = { strokeColor: '#000000' as HexColor, strokeWidth: 1, strokeStyle: 'dotted' };
    expect(solidStrokeToStyle(stroke)).toContain('dotted');
  });

  it('uses rgba color when strokeOpacity is present', () => {
    const stroke: Stroke = {
      strokeColor: '#ff0000' as HexColor,
      strokeOpacity: 0.5,
      strokeWidth: 2,
      strokeAlignment: 'center',
    };
    expect(solidStrokeToStyle(stroke)).toContain('rgba(255, 0, 0, 0.5)');
  });

  it('uses border for inner alignment', () => {
    const stroke: Stroke = {
      strokeColor: '#ff0000' as HexColor,
      strokeWidth: 3,
      strokeAlignment: 'inner',
    };
    const result = solidStrokeToStyle(stroke);
    expect(result).toContain('border:');
    expect(result).toContain('3px');
    expect(result).toContain('#ff0000');
  });

  it('uses box-shadow for outer alignment', () => {
    const stroke: Stroke = {
      strokeColor: '#ff0000' as HexColor,
      strokeWidth: 3,
      strokeAlignment: 'outer',
    };
    const result = solidStrokeToStyle(stroke);
    expect(result).toBe('box-shadow: 0 0 0 3px #ff0000;');
  });

  it('uses rgba for outer alignment with opacity', () => {
    const stroke: Stroke = {
      strokeColor: '#ff0000' as HexColor,
      strokeOpacity: 0.5,
      strokeWidth: 2,
      strokeAlignment: 'outer',
    };
    expect(solidStrokeToStyle(stroke)).toContain('rgba(255, 0, 0, 0.5)');
  });
});
