import { describe, it, expect } from 'vitest';
import { matrixToCss, isIdentityMatrix } from './transform';
import type { GeomMatrix } from '../../penpot.types';

const identity: GeomMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

describe('matrixToCss', () => {
  it('returns matrix() string for the identity matrix', () => {
    expect(matrixToCss(identity)).toBe('matrix(1, 0, 0, 1, 0, 0)');
  });

  it('rounds values to 4 decimal places and strips trailing zeros', () => {
    const m: GeomMatrix = {
      a: 0.123456789,
      b: -0.000012345,
      c: 1.99999,
      d: 0.33333333,
      e: 100.12345,
      f: -50.99999,
    };
    expect(matrixToCss(m)).toBe('matrix(0.1235, 0, 2, 0.3333, 100.1235, -51)');
  });

  it('handles a translation-only matrix', () => {
    const m: GeomMatrix = { a: 1, b: 0, c: 0, d: 1, e: 50, f: 75 };
    expect(matrixToCss(m)).toBe('matrix(1, 0, 0, 1, 50, 75)');
  });

  it('handles a scale matrix', () => {
    const m: GeomMatrix = { a: 2, b: 0, c: 0, d: 3, e: 0, f: 0 };
    expect(matrixToCss(m)).toBe('matrix(2, 0, 0, 3, 0, 0)');
  });

  it('handles negative values', () => {
    const m: GeomMatrix = { a: -1, b: 0, c: 0, d: -1, e: -10, f: -20 };
    expect(matrixToCss(m)).toBe('matrix(-1, 0, 0, -1, -10, -20)');
  });
});

describe('isIdentityMatrix', () => {
  it('returns true for the exact identity matrix', () => {
    expect(isIdentityMatrix(identity)).toBe(true);
  });

  it('returns true when matrix values are within epsilon 1e-4', () => {
    const m: GeomMatrix = {
      a: 1.00009,
      b: 0.00009,
      c: 0.00009,
      d: 1.00009,
      e: 0.00009,
      f: 0.00009,
    };
    expect(isIdentityMatrix(m)).toBe(true);
  });

  it('returns false when any value exceeds epsilon', () => {
    const m: GeomMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0.001, f: 0 };
    expect(isIdentityMatrix(m)).toBe(false);
  });

  it('returns false for a scale matrix', () => {
    const m: GeomMatrix = { a: 2, b: 0, c: 0, d: 1, e: 0, f: 0 };
    expect(isIdentityMatrix(m)).toBe(false);
  });

  it('returns false for a rotation matrix', () => {
    const angle = Math.PI / 4;
    const m: GeomMatrix = {
      a: Math.cos(angle),
      b: Math.sin(angle),
      c: -Math.sin(angle),
      d: Math.cos(angle),
      e: 0,
      f: 0,
    };
    expect(isIdentityMatrix(m)).toBe(false);
  });

  it('returns false for a translation matrix', () => {
    const m: GeomMatrix = { a: 1, b: 0, c: 0, d: 1, e: 10, f: 0 };
    expect(isIdentityMatrix(m)).toBe(false);
  });
});
