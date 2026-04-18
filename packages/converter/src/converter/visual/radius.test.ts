import { describe, it, expect } from 'vitest';
import { radiusToStyle } from './radius';
import type { ShapeCommon, Uuid } from '../../penpot.types';

const makeShape = (overrides: Partial<ShapeCommon> = {}): ShapeCommon => ({
  id: 'shape-1' as Uuid,
  name: 'test',
  type: 'rect',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...overrides,
});

describe('radiusToStyle', () => {
  it('returns empty when no radii are set', () => {
    expect(radiusToStyle(makeShape())).toBe('');
  });

  it('returns border-radius shorthand when all radii are equal', () => {
    expect(radiusToStyle(makeShape({ r1: 8, r2: 8, r3: 8, r4: 8 }))).toBe('border-radius: 8px;');
  });

  it('returns 4-value border-radius when only r1 is set (others default to 0)', () => {
    expect(radiusToStyle(makeShape({ r1: 4 }))).toBe('border-radius: 4px 0px 0px 0px;');
  });

  it('returns border-radius: 0px when all radii explicitly 0', () => {
    expect(radiusToStyle(makeShape({ r1: 0, r2: 0, r3: 0, r4: 0 }))).toBe('border-radius: 0px;');
  });

  it('returns 4-value border-radius when radii differ', () => {
    expect(radiusToStyle(makeShape({ r1: 4, r2: 8, r3: 12, r4: 0 }))).toBe(
      'border-radius: 4px 8px 12px 0px;',
    );
  });

  it('treats undefined radii as 0 in 4-value output', () => {
    expect(radiusToStyle(makeShape({ r1: 10, r2: undefined, r3: undefined, r4: 5 }))).toBe(
      'border-radius: 10px 0px 0px 5px;',
    );
  });

  it('returns border-radius shorthand for single consistent value', () => {
    expect(radiusToStyle(makeShape({ r1: 16, r2: 16, r3: 16, r4: 16 }))).toBe(
      'border-radius: 16px;',
    );
  });
});
