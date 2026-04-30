import { describe, it, expect } from 'vitest';
import {
  layoutItemSizingStyle,
  layoutItemMarginStyle,
  layoutItemAlignSelfStyle,
  layoutItemMinMaxStyle,
  layoutItemZIndexStyle,
  layoutItemAbsoluteStyle,
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

const makeColParent = (): FrameShape => ({ ...makeRowParent(), layoutFlexDir: 'column' });

describe('layoutItemSizingStyle', () => {
  it('returns explicit width/height when no sizing is set (defaults to fix)', () => {
    const result = layoutItemSizingStyle(makeShape(), makeRowParent());
    expect(result).toContain('width: 100px;');
    expect(result).toContain('height: 50px;');
  });

  it('returns flex: 1 for fill HSizing in row parent (main axis)', () => {
    const result = layoutItemSizingStyle(makeShape({ layoutItemHSizing: 'fill' }), makeRowParent());
    expect(result).toContain('flex: 1;');
  });

  it('returns height: 100% for fill VSizing in row parent (cross axis)', () => {
    const result = layoutItemSizingStyle(makeShape({ layoutItemVSizing: 'fill' }), makeRowParent());
    expect(result).toContain('height: 100%;');
  });

  it('returns explicit height for fill VSizing when row parent wraps (cross axis is per-row, not full container)', () => {
    const result = layoutItemSizingStyle(
      makeShape({ layoutItemVSizing: 'fill', height: 23 }),
      makeRowParent(),
      true,
    );
    expect(result).toContain('height: 23px;');
    expect(result).not.toContain('height: 100%;');
  });

  it('returns flex: 1 for fill VSizing in column parent (main axis)', () => {
    const result = layoutItemSizingStyle(makeShape({ layoutItemVSizing: 'fill' }), makeColParent());
    expect(result).toContain('flex: 1;');
  });

  it('returns explicit width for fill HSizing in column parent (cross axis — prevents overflow inflation)', () => {
    const result = layoutItemSizingStyle(makeShape({ layoutItemHSizing: 'fill' }), makeColParent());
    expect(result).toContain('width: 100px;');
    expect(result).not.toContain('width: 100%;');
  });

  it('falls back to selrect dimensions when shape.width/height are null (path shapes)', () => {
    const pathLike = makeShape({
      type: 'path',
      width: null as unknown as number,
      height: null as unknown as number,
      layoutItemHSizing: 'fill',
      selrect: { x: 0, y: 0, width: 400, height: 1 },
    });
    const result = layoutItemSizingStyle(pathLike, makeColParent());
    expect(result).toContain('width: 400px;');
    expect(result).toContain('height: 1px;');
    expect(result).not.toContain('width: 0px');
    expect(result).not.toContain('height: 0px');
  });

  it('returns explicit width for fix HSizing', () => {
    const result = layoutItemSizingStyle(
      makeShape({ layoutItemHSizing: 'fix', width: 120 }),
      makeRowParent(),
    );
    expect(result).toContain('width: 120px;');
  });

  it('returns explicit height for fix VSizing', () => {
    const result = layoutItemSizingStyle(
      makeShape({ layoutItemVSizing: 'fix', height: 60 }),
      makeRowParent(),
    );
    expect(result).toContain('height: 60px;');
  });

  it('returns empty string for auto sizing', () => {
    const result = layoutItemSizingStyle(
      makeShape({ layoutItemHSizing: 'auto', layoutItemVSizing: 'auto' }),
      makeRowParent(),
    );
    expect(result).toBe('');
  });

  it('emits flex-shrink: 0 on the main axis when fix-sized (prevents collapse to min-content)', () => {
    const rowFix = layoutItemSizingStyle(
      makeShape({ layoutItemHSizing: 'fix', layoutItemVSizing: 'fix' }),
      makeRowParent(),
    );
    expect(rowFix).toContain('flex-shrink: 0;');

    const colFix = layoutItemSizingStyle(
      makeShape({ layoutItemHSizing: 'fix', layoutItemVSizing: 'fix' }),
      makeColParent(),
    );
    expect(colFix).toContain('flex-shrink: 0;');
  });

  it('does not emit flex-shrink: 0 when main axis is fill or auto', () => {
    const rowFill = layoutItemSizingStyle(
      makeShape({ layoutItemHSizing: 'fill', layoutItemVSizing: 'fix' }),
      makeRowParent(),
    );
    expect(rowFill).not.toContain('flex-shrink');

    const colAuto = layoutItemSizingStyle(
      makeShape({ layoutItemHSizing: 'fix', layoutItemVSizing: 'auto' }),
      makeColParent(),
    );
    expect(colAuto).not.toContain('flex-shrink');
  });
});

describe('layoutItemMarginStyle', () => {
  it('returns empty string when layoutItemMargin is undefined', () => {
    expect(layoutItemMarginStyle(makeShape())).toBe('');
  });

  it('emits margin: Npx when all sides are equal', () => {
    expect(
      layoutItemMarginStyle(makeShape({ layoutItemMargin: { m1: 8, m2: 8, m3: 8, m4: 8 } })),
    ).toBe('margin: 8px;');
  });

  it('emits 4-value margin when sides differ', () => {
    expect(
      layoutItemMarginStyle(makeShape({ layoutItemMargin: { m1: 4, m2: 8, m3: 12, m4: 16 } })),
    ).toBe('margin: 4px 8px 12px 16px;');
  });

  it('handles zero margins', () => {
    expect(
      layoutItemMarginStyle(makeShape({ layoutItemMargin: { m1: 0, m2: 0, m3: 0, m4: 0 } })),
    ).toBe('margin: 0px;');
  });

  it('treats missing margin sides as 0 (not undefined)', () => {
    expect(
      layoutItemMarginStyle(
        makeShape({ layoutItemMargin: { m1: 0, m2: 0, m3: 0 } as ShapeCommon['layoutItemMargin'] }),
      ),
    ).toBe('margin: 0px;');
  });
});

describe('layoutItemAlignSelfStyle', () => {
  it('returns empty string when undefined', () => {
    expect(layoutItemAlignSelfStyle(makeShape())).toBe('');
  });
  it('maps start to align-self: flex-start', () => {
    expect(layoutItemAlignSelfStyle(makeShape({ layoutItemAlignSelf: 'start' }))).toBe(
      'align-self: flex-start;',
    );
  });
  it('maps center to align-self: center', () => {
    expect(layoutItemAlignSelfStyle(makeShape({ layoutItemAlignSelf: 'center' }))).toBe(
      'align-self: center;',
    );
  });
  it('maps end to align-self: flex-end', () => {
    expect(layoutItemAlignSelfStyle(makeShape({ layoutItemAlignSelf: 'end' }))).toBe(
      'align-self: flex-end;',
    );
  });
  it('maps stretch to align-self: stretch', () => {
    expect(layoutItemAlignSelfStyle(makeShape({ layoutItemAlignSelf: 'stretch' }))).toBe(
      'align-self: stretch;',
    );
  });
});

describe('layoutItemMinMaxStyle', () => {
  it('returns empty string when no min/max set', () => {
    expect(layoutItemMinMaxStyle(makeShape())).toBe('');
  });
  it('emits min-width when hSizing is fill', () => {
    expect(
      layoutItemMinMaxStyle(makeShape({ layoutItemHSizing: 'fill', layoutItemMinW: 50 })),
    ).toContain('min-width: 50px;');
  });
  it('emits max-width when hSizing is fill', () => {
    expect(
      layoutItemMinMaxStyle(makeShape({ layoutItemHSizing: 'fill', layoutItemMaxW: 200 })),
    ).toContain('max-width: 200px;');
  });
  it('emits min-height when vSizing is fill', () => {
    expect(
      layoutItemMinMaxStyle(makeShape({ layoutItemVSizing: 'fill', layoutItemMinH: 30 })),
    ).toContain('min-height: 30px;');
  });
  it('emits max-height when vSizing is auto', () => {
    expect(
      layoutItemMinMaxStyle(makeShape({ layoutItemVSizing: 'auto', layoutItemMaxH: 100 })),
    ).toContain('max-height: 100px;');
  });
  it('skips min-height when vSizing is fix (explicit dimension wins)', () => {
    expect(layoutItemMinMaxStyle(makeShape({ layoutItemVSizing: 'fix', layoutItemMinH: 80 }))).toBe(
      '',
    );
  });
  it('skips min-width when hSizing is undefined (defaults to fix)', () => {
    expect(layoutItemMinMaxStyle(makeShape({ layoutItemMinW: 80 }))).toBe('');
  });
});

describe('layoutItemZIndexStyle', () => {
  it('returns empty string when undefined', () => {
    expect(layoutItemZIndexStyle(makeShape())).toBe('');
  });
  it('returns empty string when zero', () => {
    expect(layoutItemZIndexStyle(makeShape({ layoutItemZIndex: 0 }))).toBe('');
  });
  it('returns z-index for non-zero', () => {
    expect(layoutItemZIndexStyle(makeShape({ layoutItemZIndex: 10 }))).toBe('z-index: 10;');
  });
  it('handles negative z-index', () => {
    expect(layoutItemZIndexStyle(makeShape({ layoutItemZIndex: -1 }))).toBe('z-index: -1;');
  });
});

describe('layoutItemAbsoluteStyle', () => {
  it('returns empty string when layoutItemAbsolute is false', () => {
    expect(layoutItemAbsoluteStyle(makeShape({ layoutItemAbsolute: false }))).toBe('');
  });
  it('returns empty string when layoutItemAbsolute is undefined', () => {
    expect(layoutItemAbsoluteStyle(makeShape())).toBe('');
  });
  it('returns absolute with left/top when layoutItemAbsolute is true', () => {
    const result = layoutItemAbsoluteStyle(makeShape({ layoutItemAbsolute: true, x: 20, y: 30 }));
    expect(result).toContain('position: absolute;');
    expect(result).toContain('left: 20px;');
    expect(result).toContain('top: 30px;');
  });
});
