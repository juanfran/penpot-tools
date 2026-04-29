import { describe, expect, it } from 'vitest';
import { parseCssTransform } from './transform';

describe('parseCssTransform', () => {
  it('returns null for "none"', () => {
    expect(parseCssTransform('none')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseCssTransform('')).toBeNull();
  });

  it('parses CSS rotate(-4deg) — sign flips for Penpot', () => {
    // rotate(-4deg) → matrix(cos(-4°), sin(-4°), -sin(-4°), cos(-4°), 0, 0)
    const cos = Math.cos((-4 * Math.PI) / 180);
    const sin = Math.sin((-4 * Math.PI) / 180);
    const result = parseCssTransform(`matrix(${cos}, ${sin}, ${-sin}, ${cos}, 0, 0)`);
    expect(result?.rotationDeg).toBeCloseTo(4, 3);
    expect(result?.hasUnsupportedComponent).toBe(false);
  });

  it('parses CSS rotate(45deg) → Penpot rotation -45', () => {
    const cos = Math.cos((45 * Math.PI) / 180);
    const sin = Math.sin((45 * Math.PI) / 180);
    const result = parseCssTransform(`matrix(${cos}, ${sin}, ${-sin}, ${cos}, 0, 0)`);
    expect(result?.rotationDeg).toBeCloseTo(-45, 3);
  });

  it('flags non-identity scale as unsupported', () => {
    const result = parseCssTransform('matrix(2, 0, 0, 2, 0, 0)');
    expect(result?.hasUnsupportedComponent).toBe(true);
  });

  it('ignores translation components', () => {
    const result = parseCssTransform('matrix(1, 0, 0, 1, 50, 100)');
    expect(result?.rotationDeg).toBe(-0);
    expect(result?.hasUnsupportedComponent).toBe(false);
  });

  it('parses matrix3d for 2D rotation', () => {
    const cos = Math.cos((10 * Math.PI) / 180);
    const sin = Math.sin((10 * Math.PI) / 180);
    const result = parseCssTransform(
      `matrix3d(${cos}, ${sin}, 0, 0, ${-sin}, ${cos}, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)`,
    );
    expect(result?.rotationDeg).toBeCloseTo(-10, 3);
  });
});
