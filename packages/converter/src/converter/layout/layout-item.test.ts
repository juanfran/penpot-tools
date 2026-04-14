import { describe, it, expect } from 'vitest';
import {
  layoutItemSizingClasses,
  layoutItemMarginClasses,
  layoutItemAlignSelfClass,
  layoutItemMinMaxClasses,
  layoutItemZIndexClass,
  layoutItemAbsoluteClasses,
} from './layout-item';
import type { ShapeCommon, FrameShape, Uuid } from '../../penpot.types';

const makeShape = (overrides: Partial<ShapeCommon> = {}): ShapeCommon => ({
  id: 'shape-1' as Uuid,
  name: 'Shape',
  type: 'rect',
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  selrect: { x: 0, y: 0, width: 100, height: 50 },
  points: [],
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  parentId: 'frame-1' as Uuid,
  frameId: 'frame-1' as Uuid,
  ...overrides,
});

const makeRowParent = (): FrameShape => ({
  id: 'frame-1' as Uuid,
  name: 'Frame',
  type: 'frame',
  x: 0,
  y: 0,
  width: 400,
  height: 300,
  shapes: [],
  selrect: { x: 0, y: 0, width: 400, height: 300 },
  points: [],
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  parentId: 'frame-1' as Uuid,
  frameId: 'frame-1' as Uuid,
  layoutType: 'flex',
  layoutFlexDir: 'row',
});

const makeColParent = (): FrameShape => ({
  ...makeRowParent(),
  layoutFlexDir: 'column',
});

describe('layoutItemSizingClasses', () => {
  it('returns explicit w/h when no sizing is set (defaults to fix)', () => {
    const result = layoutItemSizingClasses(makeShape(), makeRowParent());
    expect(result).toContain('w-[100px]');
    expect(result).toContain('h-[50px]');
  });

  it('returns flex-1 for fill HSizing in row parent (main axis)', () => {
    const result = layoutItemSizingClasses(
      makeShape({ layoutItemHSizing: 'fill' }),
      makeRowParent(),
    );
    expect(result).toContain('flex-1');
  });

  it('returns h-full for fill VSizing in row parent (cross axis)', () => {
    const result = layoutItemSizingClasses(
      makeShape({ layoutItemVSizing: 'fill' }),
      makeRowParent(),
    );
    expect(result).toContain('h-full');
  });

  it('returns flex-1 for fill VSizing in column parent (main axis)', () => {
    const result = layoutItemSizingClasses(
      makeShape({ layoutItemVSizing: 'fill' }),
      makeColParent(),
    );
    expect(result).toContain('flex-1');
  });

  it('returns w-[Npx] for fill HSizing in column parent (cross axis — prevents overflow inflation)', () => {
    const result = layoutItemSizingClasses(
      makeShape({ layoutItemHSizing: 'fill' }),
      makeColParent(),
    );
    expect(result).toContain('w-[100px]');
    expect(result).not.toContain('w-full');
  });

  it('returns w-[Npx] for fix HSizing', () => {
    const result = layoutItemSizingClasses(
      makeShape({ layoutItemHSizing: 'fix', width: 120 }),
      makeRowParent(),
    );
    expect(result).toContain('w-[120px]');
  });

  it('returns h-[Npx] for fix VSizing', () => {
    const result = layoutItemSizingClasses(
      makeShape({ layoutItemVSizing: 'fix', height: 60 }),
      makeRowParent(),
    );
    expect(result).toContain('h-[60px]');
  });

  it('returns empty string for auto sizing', () => {
    const result = layoutItemSizingClasses(
      makeShape({ layoutItemHSizing: 'auto', layoutItemVSizing: 'auto' }),
      makeRowParent(),
    );
    expect(result).toBe('');
  });
});

describe('layoutItemMarginClasses', () => {
  it('returns empty when layoutItemMargin is undefined', () => {
    const result = layoutItemMarginClasses(makeShape());
    expect(result.classes).toBe('');
    expect(result.style).toBe('');
  });

  it('emits m-[Npx] when all sides are equal', () => {
    const result = layoutItemMarginClasses(
      makeShape({ layoutItemMargin: { m1: 8, m2: 8, m3: 8, m4: 8 } }),
    );
    expect(result.classes).toContain('m-[8px]');
    expect(result.style).toBe('');
  });

  it('emits mx and my when top=bottom and left=right', () => {
    const result = layoutItemMarginClasses(
      makeShape({ layoutItemMargin: { m1: 4, m2: 12, m3: 4, m4: 12 } }),
    );
    expect(result.classes).toContain('my-[4px]');
    expect(result.classes).toContain('mx-[12px]');
    expect(result.style).toBe('');
  });

  it('emits inline margin style when sides differ', () => {
    const result = layoutItemMarginClasses(
      makeShape({ layoutItemMargin: { m1: 4, m2: 8, m3: 12, m4: 16 } }),
    );
    expect(result.style).toContain('margin: 4px 8px 12px 16px;');
    expect(result.classes).toBe('');
  });

  it('handles zero margins as m-[0px]', () => {
    const result = layoutItemMarginClasses(
      makeShape({ layoutItemMargin: { m1: 0, m2: 0, m3: 0, m4: 0 } }),
    );
    expect(result.classes).toContain('m-[0px]');
  });
});

describe('layoutItemAlignSelfClass', () => {
  it('returns empty string when undefined', () => {
    expect(layoutItemAlignSelfClass(makeShape())).toBe('');
  });
  it('maps start to self-start', () => {
    expect(layoutItemAlignSelfClass(makeShape({ layoutItemAlignSelf: 'start' }))).toBe(
      'self-start',
    );
  });
  it('maps center to self-center', () => {
    expect(layoutItemAlignSelfClass(makeShape({ layoutItemAlignSelf: 'center' }))).toBe(
      'self-center',
    );
  });
  it('maps end to self-end', () => {
    expect(layoutItemAlignSelfClass(makeShape({ layoutItemAlignSelf: 'end' }))).toBe('self-end');
  });
  it('maps stretch to self-stretch', () => {
    expect(layoutItemAlignSelfClass(makeShape({ layoutItemAlignSelf: 'stretch' }))).toBe(
      'self-stretch',
    );
  });
});

describe('layoutItemMinMaxClasses', () => {
  it('returns empty string when no min/max set', () => {
    expect(layoutItemMinMaxClasses(makeShape())).toBe('');
  });
  it('emits min-w-[Npx]', () => {
    expect(layoutItemMinMaxClasses(makeShape({ layoutItemMinW: 50 }))).toContain('min-w-[50px]');
  });
  it('emits max-w-[Npx]', () => {
    expect(layoutItemMinMaxClasses(makeShape({ layoutItemMaxW: 200 }))).toContain('max-w-[200px]');
  });
  it('emits min-h-[Npx]', () => {
    expect(layoutItemMinMaxClasses(makeShape({ layoutItemMinH: 30 }))).toContain('min-h-[30px]');
  });
  it('emits max-h-[Npx]', () => {
    expect(layoutItemMinMaxClasses(makeShape({ layoutItemMaxH: 100 }))).toContain('max-h-[100px]');
  });
  it('combines multiple constraints', () => {
    const result = layoutItemMinMaxClasses(
      makeShape({
        layoutItemMinW: 50,
        layoutItemMaxW: 200,
        layoutItemMinH: 30,
        layoutItemMaxH: 100,
      }),
    );
    expect(result).toContain('min-w-[50px]');
    expect(result).toContain('max-w-[200px]');
    expect(result).toContain('min-h-[30px]');
    expect(result).toContain('max-h-[100px]');
  });
});

describe('layoutItemZIndexClass', () => {
  it('returns empty string when undefined', () => {
    expect(layoutItemZIndexClass(makeShape())).toBe('');
  });
  it('returns empty string when zero', () => {
    expect(layoutItemZIndexClass(makeShape({ layoutItemZIndex: 0 }))).toBe('');
  });
  it('returns z-[N] for non-zero z-index', () => {
    expect(layoutItemZIndexClass(makeShape({ layoutItemZIndex: 10 }))).toBe('z-[10]');
  });
  it('handles negative z-index', () => {
    expect(layoutItemZIndexClass(makeShape({ layoutItemZIndex: -1 }))).toBe('z-[-1]');
  });
});

describe('layoutItemAbsoluteClasses', () => {
  it('returns empty string when layoutItemAbsolute is false', () => {
    expect(layoutItemAbsoluteClasses(makeShape({ layoutItemAbsolute: false }))).toBe('');
  });
  it('returns empty string when layoutItemAbsolute is undefined', () => {
    expect(layoutItemAbsoluteClasses(makeShape())).toBe('');
  });
  it('returns absolute with left/top when layoutItemAbsolute is true', () => {
    const result = layoutItemAbsoluteClasses(makeShape({ layoutItemAbsolute: true, x: 20, y: 30 }));
    expect(result).toContain('absolute');
    expect(result).toContain('left-[20px]');
    expect(result).toContain('top-[30px]');
  });
});
