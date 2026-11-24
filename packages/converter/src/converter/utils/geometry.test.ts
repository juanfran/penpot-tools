import { describe, it, expect } from 'vitest';
import { shapeBox } from './geometry';
import type { ShapeCommon } from '../../penpot.types';

// Penpot sends path and bool shapes with x/y/width/height set to null and
// their geometry in `selrect`. The types say `number | undefined`, so the
// null case needs a cast.
const nullGeom = { x: null, y: null, width: null, height: null } as unknown as Pick<
  ShapeCommon,
  'x' | 'y' | 'width' | 'height'
>;

describe('shapeBox', () => {
  it('uses x/y/width/height when present', () => {
    expect(
      shapeBox({ x: 1, y: 2, width: 3, height: 4, selrect: { x: 9, y: 9, width: 9, height: 9 } }),
    ).toEqual({ x: 1, y: 2, width: 3, height: 4 });
  });

  it('falls back to selrect when the fields are null (path shapes)', () => {
    expect(
      shapeBox({ ...nullGeom, selrect: { x: 9810, y: -59, width: 1910, height: 1052 } }),
    ).toEqual({ x: 9810, y: -59, width: 1910, height: 1052 });
  });

  it('keeps a real 0 instead of falling back', () => {
    expect(
      shapeBox({
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        selrect: { x: 5, y: 5, width: 10, height: 10 },
      }),
    ).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });

  it('returns zeros when neither source has geometry', () => {
    expect(shapeBox({} as Pick<ShapeCommon, 'x' | 'y' | 'width' | 'height' | 'selrect'>)).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  });

  it('prefers selrect for path and bool shapes, whose x/y Penpot leaves stale on move', () => {
    const moved = {
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      selrect: { x: 500, y: 500, width: 50, height: 50 },
    };
    expect(shapeBox({ ...moved, type: 'bool' })).toEqual({ x: 500, y: 500, width: 50, height: 50 });
    expect(shapeBox({ ...moved, type: 'path' })).toEqual({ x: 500, y: 500, width: 50, height: 50 });
    expect(shapeBox({ ...moved, type: 'rect' })).toEqual({ x: 100, y: 100, width: 50, height: 50 });
  });
});
