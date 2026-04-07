import { describe, it, expect } from 'vitest';
import {
  rotationToClass,
  transformToStyle,
  absolutePositionClasses,
  constraintsHToStyle,
  constraintsVToStyle,
  combinedTransformStyle,
} from './position';
import type { GeomMatrix, ShapeCommon, Uuid } from '../../penpot.types';

const makeShape = (overrides: Partial<ShapeCommon> = {}): ShapeCommon => ({
  id: 'shape-1' as Uuid,
  name: 'test',
  type: 'rect',
  selrect: { x: 0, y: 0, width: 100, height: 100 },
  points: [],
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  parentId: 'parent-1' as Uuid,
  frameId: 'frame-1' as Uuid,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...overrides,
});

const identity: GeomMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

describe('rotationToClass', () => {
  it('returns empty string for undefined rotation', () => {
    expect(rotationToClass(undefined)).toBe('');
  });

  it('returns empty string for 0 rotation', () => {
    expect(rotationToClass(0)).toBe('');
  });

  it('negates rotation (Penpot CCW → CSS CW)', () => {
    expect(rotationToClass(45)).toBe('rotate-[-45deg]');
  });

  it('handles negative rotation', () => {
    expect(rotationToClass(-90)).toBe('rotate-[90deg]');
  });

  it('handles 180 degrees', () => {
    expect(rotationToClass(180)).toBe('rotate-[-180deg]');
  });

  it('handles non-integer rotation', () => {
    expect(rotationToClass(30)).toBe('rotate-[-30deg]');
  });
});

describe('transformToStyle', () => {
  it('returns empty string for identity matrix', () => {
    expect(transformToStyle(identity)).toBe('');
  });

  it('returns transform style for non-identity matrix', () => {
    const m: GeomMatrix = { a: 0.5, b: 0, c: 0, d: 0.5, e: 10, f: 20 };
    expect(transformToStyle(m)).toBe(
      'transform: matrix(0.5, 0, 0, 0.5, 10, 20);',
    );
  });

  describe('absolutePositionClasses', () => {
    it('returns absolute position and size classes', () => {
      const result = absolutePositionClasses(
        makeShape({ x: 10, y: 20, width: 200, height: 150 }),
      );
      expect(result).toContain('absolute');
      expect(result).toContain('left-[10px]');
      expect(result).toContain('top-[20px]');
      expect(result).toContain('w-[200px]');
      expect(result).toContain('h-[150px]');
    });

    it('handles x=0 and y=0', () => {
      const result = absolutePositionClasses(
        makeShape({ x: 0, y: 0, width: 100, height: 100 }),
      );
      expect(result).toContain('left-[0px]');
      expect(result).toContain('top-[0px]');
    });

    it('handles fractional values', () => {
      const result = absolutePositionClasses(
        makeShape({ x: 10.5, y: 20.75, width: 100, height: 100 }),
      );
      expect(result).toContain('left-[10.5px]');
      expect(result).toContain('top-[20.75px]');
    });

    it('defaults missing dimensions to 0', () => {
      const result = absolutePositionClasses(
        makeShape({
          x: undefined,
          y: undefined,
          width: undefined,
          height: undefined,
        }),
      );
      expect(result).toContain('left-[0px]');
      expect(result).toContain('top-[0px]');
      expect(result).toContain('w-[0px]');
      expect(result).toContain('h-[0px]');
    });

    it('emits fixed when fixedScroll is true and isChildOfRoot is true', () => {
      const result = absolutePositionClasses(
        makeShape({ fixedScroll: true }),
        true,
      );
      expect(result).toContain('fixed');
      expect(result).not.toContain('absolute');
    });

    it('emits absolute when fixedScroll is true but isChildOfRoot is false', () => {
      const result = absolutePositionClasses(
        makeShape({ fixedScroll: true }),
        false,
      );
      expect(result).toContain('absolute');
      expect(result).not.toContain('fixed');
    });

    it('emits absolute when fixedScroll is false even if isChildOfRoot is true', () => {
      const result = absolutePositionClasses(
        makeShape({ fixedScroll: false }),
        true,
      );
      expect(result).toContain('absolute');
      expect(result).not.toContain('fixed');
    });
  });

  describe('constraintsHToStyle', () => {
    const parent = makeShape({ x: 0, y: 0, width: 400, height: 300 });

    it('left constraint: emits left only', () => {
      const shape = makeShape({
        x: 20,
        y: 0,
        width: 100,
        height: 50,
        constraintsH: 'left',
      });
      expect(constraintsHToStyle(shape, parent)).toBe('left: 20px;');
    });

    it('right constraint: emits right based on parent width', () => {
      const shape = makeShape({
        x: 280,
        y: 0,
        width: 100,
        height: 50,
        constraintsH: 'right',
      });
      // right = 400 - 280 - 100 = 20
      expect(constraintsHToStyle(shape, parent)).toBe('right: 20px;');
    });

    it('center constraint: emits left 50% and translateX', () => {
      const shape = makeShape({
        x: 150,
        y: 0,
        width: 100,
        height: 50,
        constraintsH: 'center',
      });
      expect(constraintsHToStyle(shape, parent)).toBe(
        'left: 50%; transform: translateX(-50%);',
      );
    });

    it('leftright constraint: emits left, right, and width unset', () => {
      const shape = makeShape({
        x: 20,
        y: 0,
        width: 360,
        height: 50,
        constraintsH: 'leftright',
      });
      // right = 400 - 20 - 360 = 20
      expect(constraintsHToStyle(shape, parent)).toBe(
        'left: 20px; right: 20px; width: unset;',
      );
    });

    it('scale constraint: emits left% and width%', () => {
      const shape = makeShape({
        x: 100,
        y: 0,
        width: 200,
        height: 50,
        constraintsH: 'scale',
      });
      // left = 100/400*100 = 25%, width = 200/400*100 = 50%
      expect(constraintsHToStyle(shape, parent)).toBe('left: 25%; width: 50%;');
    });

    it('defaults to left constraint when undefined', () => {
      const shape = makeShape({ x: 10, y: 0, width: 100, height: 50 });
      expect(constraintsHToStyle(shape, parent)).toBe('left: 10px;');
    });
  });

  describe('constraintsVToStyle', () => {
    const parent = makeShape({ x: 0, y: 0, width: 400, height: 300 });

    it('top constraint: emits top only', () => {
      const shape = makeShape({
        x: 0,
        y: 20,
        width: 100,
        height: 50,
        constraintsV: 'top',
      });
      expect(constraintsVToStyle(shape, parent)).toBe('top: 20px;');
    });

    it('bottom constraint: emits bottom based on parent height', () => {
      const shape = makeShape({
        x: 0,
        y: 230,
        width: 100,
        height: 50,
        constraintsV: 'bottom',
      });
      // bottom = 300 - 230 - 50 = 20
      expect(constraintsVToStyle(shape, parent)).toBe('bottom: 20px;');
    });

    it('center constraint: emits top 50% and translateY', () => {
      const shape = makeShape({
        x: 0,
        y: 125,
        width: 100,
        height: 50,
        constraintsV: 'center',
      });
      expect(constraintsVToStyle(shape, parent)).toBe(
        'top: 50%; transform: translateY(-50%);',
      );
    });

    it('topbottom constraint: emits top, bottom, and height unset', () => {
      const shape = makeShape({
        x: 0,
        y: 20,
        width: 100,
        height: 260,
        constraintsV: 'topbottom',
      });
      // bottom = 300 - 20 - 260 = 20
      expect(constraintsVToStyle(shape, parent)).toBe(
        'top: 20px; bottom: 20px; height: unset;',
      );
    });

    it('scale constraint: emits top% and height%', () => {
      const shape = makeShape({
        x: 0,
        y: 60,
        width: 100,
        height: 150,
        constraintsV: 'scale',
      });
      // top = 60/300*100 = 20%, height = 150/300*100 = 50%
      expect(constraintsVToStyle(shape, parent)).toBe('top: 20%; height: 50%;');
    });

    it('defaults to top constraint when undefined', () => {
      const shape = makeShape({ x: 0, y: 10, width: 100, height: 50 });
      expect(constraintsVToStyle(shape, parent)).toBe('top: 10px;');
    });
  });

  it('handles rotation matrix', () => {
    const angle = Math.PI / 4; // 45 degrees
    const m: GeomMatrix = {
      a: Math.cos(angle),
      b: Math.sin(angle),
      c: -Math.sin(angle),
      d: Math.cos(angle),
      e: 0,
      f: 0,
    };
    const result = transformToStyle(m);
    expect(result).toMatch(/^transform: matrix\(/);
    expect(result).toContain('0.7071');
  });
});

describe('combinedTransformStyle', () => {
  it('returns empty string when no rotation and identity matrix', () => {
    expect(combinedTransformStyle(makeShape())).toBe('');
  });

  it('returns rotate() when rotation is non-zero and matrix is identity', () => {
    const result = combinedTransformStyle(makeShape({ rotation: 45 }));
    expect(result).toContain('rotate(-45deg)');
    expect(result).not.toContain('matrix');
  });

  it('returns matrix() when matrix is non-identity and no rotation', () => {
    const nonIdentity: GeomMatrix = {
      a: 0.707,
      b: 0.707,
      c: -0.707,
      d: 0.707,
      e: 0,
      f: 0,
    };
    const result = combinedTransformStyle(
      makeShape({ transform: nonIdentity }),
    );
    expect(result).toContain('matrix(');
    expect(result).not.toContain('rotate');
  });

  it('combines rotation and non-identity matrix', () => {
    const nonIdentity: GeomMatrix = {
      a: 0.707,
      b: 0.707,
      c: -0.707,
      d: 0.707,
      e: 0,
      f: 0,
    };
    const result = combinedTransformStyle(
      makeShape({ rotation: 30, transform: nonIdentity }),
    );
    expect(result).toContain('rotate(-30deg)');
    expect(result).toContain('matrix(');
  });
});
