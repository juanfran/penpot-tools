import { describe, it, expect } from 'vitest';
import { radiusToOutput } from './radius';
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

describe('radiusToOutput', () => {
  it('returns empty when no radii are set', () => {
    const result = radiusToOutput(makeShape());
    expect(result.classes).toBe('');
    expect(result.style).toBe('');
  });

  it('returns rounded-[Npx] class when all radii are equal', () => {
    const result = radiusToOutput(makeShape({ r1: 8, r2: 8, r3: 8, r4: 8 }));
    expect(result.classes).toBe('rounded-[8px]');
    expect(result.style).toBe('');
  });

  it('returns rounded-[Npx] when only r1 is set (others default to 0)', () => {
    const result = radiusToOutput(makeShape({ r1: 4 }));
    expect(result.classes).toBe('');
    expect(result.style).toBe('border-radius: 4px 0px 0px 0px;');
  });

  it('returns rounded-[0px] when all radii explicitly 0', () => {
    const result = radiusToOutput(makeShape({ r1: 0, r2: 0, r3: 0, r4: 0 }));
    expect(result.classes).toBe('rounded-[0px]');
    expect(result.style).toBe('');
  });

  it('returns inline style when radii differ', () => {
    const result = radiusToOutput(makeShape({ r1: 4, r2: 8, r3: 12, r4: 0 }));
    expect(result.classes).toBe('');
    expect(result.style).toBe('border-radius: 4px 8px 12px 0px;');
  });

  it('treats undefined radii as 0 in inline style', () => {
    const result = radiusToOutput(makeShape({ r1: 10, r2: undefined, r3: undefined, r4: 5 }));
    expect(result.classes).toBe('');
    expect(result.style).toBe('border-radius: 10px 0px 0px 5px;');
  });

  it('returns rounded-[Npx] for single consistent radius value', () => {
    const result = radiusToOutput(makeShape({ r1: 16, r2: 16, r3: 16, r4: 16 }));
    expect(result.classes).toBe('rounded-[16px]');
    expect(result.style).toBe('');
  });
});
