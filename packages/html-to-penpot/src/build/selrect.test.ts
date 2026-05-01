import { describe, expect, it } from 'vitest';
import { buildSelrect, snapCoord } from './selrect';

describe('snapCoord', () => {
  it('rounds to 2 decimals', () => {
    expect(snapCoord(97.81249809265137)).toBe(97.81);
    expect(snapCoord(0.0049)).toBe(0);
    expect(snapCoord(1.235)).toBe(1.24);
  });

  it('passes integers through unchanged', () => {
    expect(snapCoord(100)).toBe(100);
    expect(snapCoord(-3)).toBe(-3);
    expect(snapCoord(0)).toBe(0);
  });

  it('passes non-finite values through (NaN/Infinity) without snapping', () => {
    expect(Number.isNaN(snapCoord(NaN))).toBe(true);
    expect(snapCoord(Infinity)).toBe(Infinity);
  });
});

describe('buildSelrect', () => {
  it('produces a 0-rotation selrect with snapped values', () => {
    const r = buildSelrect({ x: 10.123456, y: 20, width: 100.99999, height: 30 });
    expect(r.selrect).toEqual({
      x: 10.12,
      y: 20,
      width: 101,
      height: 30,
      x1: 10.12,
      y1: 20,
      x2: 111.12,
      y2: 50,
    });
    expect(r.points).toEqual([
      { x: 10.12, y: 20 },
      { x: 111.12, y: 20 },
      { x: 111.12, y: 50 },
      { x: 10.12, y: 50 },
    ]);
  });

  it('snaps rotated corner points', () => {
    const r = buildSelrect({ x: 0, y: 0, width: 100, height: 50 }, 7);
    for (const p of r.points) {
      expect(p.x).toBe(Math.round(p.x * 100) / 100);
      expect(p.y).toBe(Math.round(p.y * 100) / 100);
    }
    // Selrect (the unrotated AABB) is unchanged by the rotation in this API —
    // only `points` carry the rotation.
    expect(r.selrect.width).toBe(100);
    expect(r.selrect.height).toBe(50);
  });
});
