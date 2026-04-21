import { describe, it, expect } from 'vitest';
import { computeDistanceLines, type Rect } from './distance-lines-compute';

function rect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}

describe('computeDistanceLines', () => {
  describe('sibling shapes (at least one axis disjoint)', () => {
    it('draws a single horizontal gap line when B is to the right of A', () => {
      const a = rect(0, 0, 100, 50);
      const b = rect(150, 0, 100, 50);

      expect(computeDistanceLines(a, b)).toEqual([
        {
          key: 'hgap',
          orientation: 'h',
          start: 100, // aRight
          end: 150, // b.x
          cross: 25, // midpoint of both y-centers (both at 25)
        },
      ]);
    });

    it('draws a single horizontal gap line when B is to the left of A', () => {
      const a = rect(200, 0, 100, 50);
      const b = rect(0, 0, 100, 50);

      expect(computeDistanceLines(a, b)).toEqual([
        {
          key: 'hgap',
          orientation: 'h',
          start: 100, // bRight
          end: 200, // a.x
          cross: 25,
        },
      ]);
    });

    it('draws a single vertical gap line when B is below A', () => {
      const a = rect(0, 0, 100, 50);
      const b = rect(0, 100, 100, 50);

      expect(computeDistanceLines(a, b)).toEqual([
        {
          key: 'vgap',
          orientation: 'v',
          start: 50, // aBottom
          end: 100, // b.y
          cross: 50, // midpoint of both x-centers (both at 50)
        },
      ]);
    });

    it('draws a single vertical gap line when B is above A', () => {
      const a = rect(0, 200, 100, 50);
      const b = rect(0, 0, 100, 50);

      expect(computeDistanceLines(a, b)).toEqual([
        {
          key: 'vgap',
          orientation: 'v',
          start: 50, // bBottom
          end: 200, // a.y
          cross: 50,
        },
      ]);
    });

    it('draws horizontal + vertical gap lines when diagonally separated', () => {
      const a = rect(0, 0, 100, 50);
      const b = rect(200, 200, 100, 50);
      // a y-center = 25; b y-center = 225; hgap cross = 125
      // a x-center = 50; b x-center = 250; vgap cross = 150

      const lines = computeDistanceLines(a, b);

      expect(lines).toHaveLength(2);
      expect(lines).toContainEqual({
        key: 'hgap',
        orientation: 'h',
        start: 100,
        end: 200,
        cross: 125,
      });
      expect(lines).toContainEqual({
        key: 'vgap',
        orientation: 'v',
        start: 50,
        end: 200,
        cross: 150,
      });
    });

    it('does not emit edge-offset lines for sibling shapes (only gap)', () => {
      // Vertically adjacent, A wider than B — edges differ on X but
      // Y is disjoint so we should NOT emit left/right edge lines.
      const a = rect(0, 0, 200, 50);
      const b = rect(20, 100, 100, 50);

      const lines = computeDistanceLines(a, b);

      expect(lines.map((l) => l.key)).toEqual(['vgap']);
    });
  });

  describe('parent / child (both axes overlap)', () => {
    it('emits four inset lines when B is fully contained in A', () => {
      const a = rect(0, 0, 200, 200);
      const b = rect(20, 30, 100, 100);
      // y-overlap = [30, 130] → yCross = 80
      // x-overlap = [20, 120] → xCross = 70

      const lines = computeDistanceLines(a, b);

      expect(lines).toHaveLength(4);
      expect(lines).toContainEqual({
        key: 'hleft',
        orientation: 'h',
        start: 0,
        end: 20,
        cross: 80,
      });
      expect(lines).toContainEqual({
        key: 'hright',
        orientation: 'h',
        start: 120,
        end: 200,
        cross: 80,
      });
      expect(lines).toContainEqual({
        key: 'vtop',
        orientation: 'v',
        start: 0,
        end: 30,
        cross: 70,
      });
      expect(lines).toContainEqual({
        key: 'vbot',
        orientation: 'v',
        start: 130,
        end: 200,
        cross: 70,
      });
    });

    it('skips edge lines where edges align', () => {
      // B is flush against A's left edge and top edge.
      const a = rect(0, 0, 200, 200);
      const b = rect(0, 0, 100, 100);

      const lines = computeDistanceLines(a, b);
      const keys = lines.map((l) => l.key).sort();

      expect(keys).toEqual(['hright', 'vbot']);
    });

    it('returns empty array for identical rects', () => {
      const a = rect(10, 10, 100, 100);
      const b = rect(10, 10, 100, 100);

      expect(computeDistanceLines(a, b)).toEqual([]);
    });

    it('handles parent/child in reverse (selected inside hovered)', () => {
      // If the inner shape is "selected" and the outer is "hovered",
      // the computation should still produce the same four inset lines.
      const outer = rect(0, 0, 200, 200);
      const inner = rect(20, 30, 100, 100);

      const forward = computeDistanceLines(outer, inner);
      const reverse = computeDistanceLines(inner, outer);

      expect(forward).toHaveLength(4);
      expect(reverse).toHaveLength(4);
      // Same lines regardless of argument order
      for (const line of forward) {
        expect(reverse).toContainEqual(line);
      }
    });
  });

  describe('partial overlap (intersection)', () => {
    it('emits four edge lines when shapes intersect diagonally', () => {
      const a = rect(0, 0, 100, 100);
      const b = rect(50, 50, 100, 100);

      const lines = computeDistanceLines(a, b);

      expect(lines).toHaveLength(4);
      expect(lines.map((l) => l.key).sort()).toEqual(['hleft', 'hright', 'vbot', 'vtop']);
    });
  });

  describe('epsilon behavior', () => {
    it('treats sub-pixel overlaps as overlap (triggers edge-offset path)', () => {
      // Gap of 0.3px — within EPS (0.5) — should be treated as overlapping.
      const a = rect(0, 0, 100, 100);
      const b = rect(100.3, 0, 100, 100);

      const lines = computeDistanceLines(a, b);

      // Both axes "overlap" → edge lines, no hgap
      expect(lines.every((l) => l.key !== 'hgap')).toBe(true);
    });

    it('treats a >0.5px gap as disjoint', () => {
      const a = rect(0, 0, 100, 100);
      const b = rect(101, 0, 100, 100);

      const lines = computeDistanceLines(a, b);

      expect(lines.some((l) => l.key === 'hgap')).toBe(true);
    });

    it('skips an edge line when edges differ by less than epsilon', () => {
      // B fully inside A, left edges differ by only 0.3px → no hleft line.
      const a = rect(0, 0, 200, 200);
      const b = rect(0.3, 30, 100, 100);

      const lines = computeDistanceLines(a, b);

      expect(lines.find((l) => l.key === 'hleft')).toBeUndefined();
      expect(lines.length).toBe(3);
    });
  });
});
