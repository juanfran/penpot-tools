import { describe, it, expect } from 'vitest';
import { baseStyles } from './base';
import type { ShapeCommon, Uuid, HexColor } from '../../penpot.types';
import type { ConverterContext } from '../types';

const ctx: ConverterContext = {
  resolveImageUrl: (id) => `https://assets.example.com/${id}`,
};

const makeShape = (overrides: Partial<ShapeCommon> = {}): ShapeCommon => ({
  id: 'shape-1' as Uuid,
  name: 'test',
  type: 'rect',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  selrect: { x: 0, y: 0, width: 100, height: 100 },
  points: [],
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  parentId: 'frame-1' as Uuid,
  frameId: 'frame-1' as Uuid,
  ...overrides,
});

describe('baseStyles', () => {
  it('returns empty string for a plain shape', () => {
    expect(baseStyles(makeShape(), ctx)).toBe('');
  });

  it('includes display: none when shape is hidden', () => {
    expect(baseStyles(makeShape({ hidden: true }), ctx)).toContain('display: none;');
  });

  it('includes opacity style', () => {
    expect(baseStyles(makeShape({ opacity: 0.5 }), ctx)).toContain('opacity: 0.5;');
  });

  it('includes blend mode style', () => {
    expect(baseStyles(makeShape({ blendMode: 'multiply' }), ctx)).toContain(
      'mix-blend-mode: multiply;',
    );
  });

  it('includes rotation in transform style', () => {
    expect(baseStyles(makeShape({ rotation: 45 }), ctx)).toContain('rotate(-45deg)');
  });

  it('includes blur style', () => {
    expect(
      baseStyles(makeShape({ blur: { type: 'layer-blur', value: 8, hidden: false } }), ctx),
    ).toContain('filter: blur(8px);');
  });

  it('includes shadow as box-shadow style', () => {
    const result = baseStyles(
      makeShape({
        shadow: [
          {
            id: null,
            style: 'drop-shadow',
            offsetX: 2,
            offsetY: 4,
            blur: 6,
            spread: 0,
            hidden: false,
            color: { color: '#000000' as HexColor, opacity: 1 },
          },
        ],
      }),
      ctx,
    );
    expect(result).toContain('box-shadow:');
  });

  it('includes corner radius style', () => {
    expect(baseStyles(makeShape({ r1: 8, r2: 8, r3: 8, r4: 8 }), ctx)).toContain(
      'border-radius: 8px;',
    );
  });

  it('merges multiple styles correctly', () => {
    const result = baseStyles(makeShape({ hidden: true, opacity: 0.5, blendMode: 'screen' }), ctx);
    expect(result).toContain('display: none;');
    expect(result).toContain('opacity: 0.5;');
    expect(result).toContain('mix-blend-mode: screen;');
  });

  it('includes border-radius and box-shadow in same style string', () => {
    const result = baseStyles(
      makeShape({
        r1: 4,
        r2: 8,
        r3: 0,
        r4: 0,
        shadow: [
          {
            id: null,
            style: 'drop-shadow',
            offsetX: 1,
            offsetY: 2,
            blur: 3,
            spread: 0,
            hidden: false,
            color: { color: '#000000' as HexColor, opacity: 1 },
          },
        ],
      }),
      ctx,
    );
    expect(result).toContain('border-radius:');
    expect(result).toContain('box-shadow:');
  });
});
