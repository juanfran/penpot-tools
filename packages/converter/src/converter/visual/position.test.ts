import { describe, it, expect } from 'vitest';
import {
  absolutePositionStyle,
  topLevelPositionStyle,
  resolvePositionOutput,
  combinedTransformStyle,
} from './position';
import type { GeomMatrix, ShapeCommon, Uuid } from '../../penpot.types';
import type { ConverterContext } from '../types';

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

describe('absolutePositionStyle', () => {
  it('returns absolute position and size styles', () => {
    const result = absolutePositionStyle(makeShape({ x: 10, y: 20, width: 200, height: 150 }));
    expect(result).toContain('position: absolute;');
    expect(result).toContain('left: 10px;');
    expect(result).toContain('top: 20px;');
    expect(result).toContain('width: 200px;');
    expect(result).toContain('height: 150px;');
  });

  it('handles x=0 and y=0', () => {
    const result = absolutePositionStyle(makeShape({ x: 0, y: 0 }));
    expect(result).toContain('left: 0px;');
    expect(result).toContain('top: 0px;');
  });

  it('handles fractional values', () => {
    const result = absolutePositionStyle(makeShape({ x: 10.5, y: 20.75 }));
    expect(result).toContain('left: 10.5px;');
    expect(result).toContain('top: 20.75px;');
  });

  it('defaults missing dimensions to 0', () => {
    const result = absolutePositionStyle(
      makeShape({ x: undefined, y: undefined, width: undefined, height: undefined }),
    );
    expect(result).toContain('left: 0px;');
    expect(result).toContain('top: 0px;');
    expect(result).toContain('width: 0px;');
    expect(result).toContain('height: 0px;');
  });

  it('emits fixed when fixedScroll is true and isChildOfRoot is true', () => {
    const result = absolutePositionStyle(makeShape({ fixedScroll: true }), true);
    expect(result).toContain('position: fixed;');
    expect(result).not.toContain('position: absolute;');
  });

  it('emits absolute when fixedScroll is true but isChildOfRoot is false', () => {
    const result = absolutePositionStyle(makeShape({ fixedScroll: true }), false);
    expect(result).toContain('position: absolute;');
    expect(result).not.toContain('position: fixed;');
  });
});

describe('topLevelPositionStyle', () => {
  it('returns top: 0px; left: 0px; with translate', () => {
    const result = topLevelPositionStyle(makeShape({ x: 100, y: 200, width: 300, height: 150 }));
    expect(result).toContain('position: absolute;');
    expect(result).toContain('top: 0px;');
    expect(result).toContain('left: 0px;');
    expect(result).toContain('width: 300px;');
    expect(result).toContain('height: 150px;');
    expect(result).toContain('transform: translate(100px, 200px);');
  });

  it('handles negative coordinates', () => {
    const result = topLevelPositionStyle(makeShape({ x: -28277, y: -22518 }));
    expect(result).toContain('transform: translate(-28277px, -22518px);');
  });

  it('handles zero coordinates', () => {
    const result = topLevelPositionStyle(makeShape({ x: 0, y: 0 }));
    expect(result).toContain('top: 0px;');
    expect(result).toContain('left: 0px;');
    expect(result).toContain('transform: translate(0px, 0px);');
  });

  it('emits fixed when fixedScroll is true and isChildOfRoot is true', () => {
    const result = topLevelPositionStyle(makeShape({ fixedScroll: true }), true);
    expect(result).toContain('position: fixed;');
    expect(result).not.toContain('position: absolute;');
  });
});

const makeCtx = (overrides: Partial<ConverterContext> = {}): ConverterContext => ({
  resolveImageUrl: (id) => id,
  ...overrides,
});

describe('resolvePositionOutput', () => {
  it('returns width/height 100% when _parentIsLayout (fills wrapper div)', () => {
    const result = resolvePositionOutput(
      makeShape({ x: 50, y: 50 }),
      makeCtx({ _parentIsLayout: true }),
    );
    expect(result).toContain('width: 100%;');
    expect(result).toContain('height: 100%;');
    expect(result).not.toContain('position:');
  });

  it('returns relative positioning when _forceRelative', () => {
    const result = resolvePositionOutput(
      makeShape({ x: 50, y: 50, width: 100, height: 100 }),
      makeCtx({ _forceRelative: true }),
    );
    expect(result).toContain('position: relative;');
  });

  it('returns translate output when _isCanvasTopLevel', () => {
    const result = resolvePositionOutput(
      makeShape({ x: 10, y: 20, width: 100, height: 80 }),
      makeCtx({ _isCanvasTopLevel: true }),
    );
    expect(result).toContain('position: absolute;');
    expect(result).toContain('top: 0px;');
    expect(result).toContain('left: 0px;');
    expect(result).toContain('transform: translate(10px, 20px);');
  });

  it('returns absolute positioning by default', () => {
    const result = resolvePositionOutput(
      makeShape({ x: 10, y: 20, width: 100, height: 80 }),
      makeCtx({ _offsetX: 5, _offsetY: 5 }),
    );
    expect(result).toContain('position: absolute;');
    expect(result).toContain('left: 5px;');
    expect(result).toContain('top: 15px;');
  });

  it('_forceRelative takes priority over _isCanvasTopLevel', () => {
    const result = resolvePositionOutput(
      makeShape({ x: 10, y: 20 }),
      makeCtx({ _forceRelative: true, _isCanvasTopLevel: true }),
    );
    expect(result).toContain('position: relative;');
    expect(result).not.toContain('transform: translate');
  });

  it('_parentIsLayout takes priority over _isCanvasTopLevel', () => {
    const result = resolvePositionOutput(
      makeShape({ x: 10, y: 20 }),
      makeCtx({ _parentIsLayout: true, _isCanvasTopLevel: true }),
    );
    expect(result).toContain('width: 100%;');
    expect(result).not.toContain('position:');
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
    const nonIdentity: GeomMatrix = { a: 0.707, b: 0.707, c: -0.707, d: 0.707, e: 0, f: 0 };
    const result = combinedTransformStyle(makeShape({ transform: nonIdentity }));
    expect(result).toContain('matrix(');
    expect(result).not.toContain('rotate');
  });

  it('combines rotation and non-identity matrix', () => {
    const nonIdentity: GeomMatrix = { a: 0.707, b: 0.707, c: -0.707, d: 0.707, e: 0, f: 0 };
    const result = combinedTransformStyle(makeShape({ rotation: 30, transform: nonIdentity }));
    expect(result).toContain('rotate(-30deg)');
    expect(result).toContain('matrix(');
  });
});
