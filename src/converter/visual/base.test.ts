import { describe, it, expect } from 'vitest';
import { baseClasses } from './base';
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
  ...overrides,
});

describe('baseClasses', () => {
  it('returns empty classes and style for a plain shape', () => {
    const result = baseClasses(makeShape(), ctx);
    expect(result.classes).toBe('');
    expect(result.style).toBe('');
  });

  it('includes hidden class when shape is hidden', () => {
    const result = baseClasses(makeShape({ hidden: true }), ctx);
    expect(result.classes).toContain('hidden');
  });

  it('includes opacity class', () => {
    const result = baseClasses(makeShape({ opacity: 0.5 }), ctx);
    expect(result.classes).toContain('opacity-[50%]');
  });

  it('includes blend mode class', () => {
    const result = baseClasses(makeShape({ blendMode: 'multiply' }), ctx);
    expect(result.classes).toContain('mix-blend-multiply');
  });

  it('includes rotation in transform style', () => {
    const result = baseClasses(makeShape({ rotation: 45 }), ctx);
    expect(result.style).toContain('rotate(-45deg)');
  });

  it('includes blur class', () => {
    const result = baseClasses(
      makeShape({ blur: { type: 'layer-blur', value: 8, hidden: false } }),
      ctx,
    );
    expect(result.classes).toContain('blur-[8px]');
  });

  it('includes shadow as Tailwind class', () => {
    const result = baseClasses(
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
    expect(result.classes).toContain('shadow-[');
    expect(result.style).not.toContain('box-shadow:');
  });

  it('includes corner radius class', () => {
    const result = baseClasses(makeShape({ r1: 8, r2: 8, r3: 8, r4: 8 }), ctx);
    expect(result.classes).toContain('rounded-[8px]');
  });

  it('merges multiple classes correctly', () => {
    const result = baseClasses(
      makeShape({ hidden: true, opacity: 0.5, blendMode: 'screen' }),
      ctx,
    );
    expect(result.classes).toContain('hidden');
    expect(result.classes).toContain('opacity-[50%]');
    expect(result.classes).toContain('mix-blend-screen');
  });

  it('puts radius in style and shadow in classes', () => {
    const result = baseClasses(
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
    expect(result.style).toContain('border-radius:');
    expect(result.classes).toContain('shadow-[');
    expect(result.style).not.toContain('box-shadow:');
  });
});
