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

  it('snaps to integer when Chrome canonicalises the matrix to 6 dp', () => {
    // Chromium serialises the rotation matrix with ~6-decimal precision, so
    // an authored `rotate(-4deg)` arrives here as `matrix(0.997564, ...)`
    // — atan2 round-trip yields `-4.000001701562398`. Pre-fix this jittered
    // value flowed straight into Penpot's `rotation` field and re-emerged in
    // every read-back, polluting the LLM's "current state" view. Snap when
    // close to integer.
    const result = parseCssTransform('matrix(0.997564, -0.0697565, 0.0697565, 0.997564, 0, 0)');
    expect(result?.rotationDeg).toBe(4);
    expect(result?.hasUnsupportedComponent).toBe(false);
  });

  it('preserves true non-integer rotations at 4 dp', () => {
    // 4.5° is genuinely intentional (e.g. tilted text); don't crush it to an
    // integer just because we snap close ones.
    const cos = Math.cos((-4.5 * Math.PI) / 180);
    const sin = Math.sin((-4.5 * Math.PI) / 180);
    const result = parseCssTransform(`matrix(${cos}, ${sin}, ${-sin}, ${cos}, 0, 0)`);
    expect(result?.rotationDeg).toBe(4.5);
  });
});
