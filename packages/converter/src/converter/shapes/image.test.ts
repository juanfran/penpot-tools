import { describe, it, expect } from 'vitest';
import { renderImage } from './image';
import type { ImageShape, Uuid } from '../../penpot.types';
import type { ConverterContext } from '../types';

const ctx: ConverterContext = {
  resolveImageUrl: (id) => `https://assets.example.com/${id}`,
};

const makeImage = (overrides: Partial<ImageShape> = {}): ImageShape => ({
  id: 'image-1' as Uuid,
  name: 'Image',
  type: 'image',
  x: 10,
  y: 20,
  width: 200,
  height: 150,
  metadata: {
    id: 'asset-uuid-1' as Uuid,
    width: 200,
    height: 150,
    mtype: 'image/png',
  },
  selrect: { x: 10, y: 20, width: 200, height: 150 },
  points: [],
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  parentId: 'parent-1' as Uuid,
  frameId: 'frame-1' as Uuid,
  ...overrides,
});

describe('renderImage', () => {
  it('renders an img element', () => {
    const html = renderImage(makeImage(), ctx);
    expect(html).toMatch(/^<img/);
  });

  it('is self-closing', () => {
    const html = renderImage(makeImage(), ctx);
    expect(html).toMatch(/\/>$/);
  });

  it('includes data-id attribute', () => {
    const html = renderImage(makeImage({ id: 'my-img' as Uuid }), ctx);
    expect(html).toContain('data-id="my-img"');
  });

  it('resolves and sets src from metadata.id', () => {
    const html = renderImage(makeImage(), ctx);
    expect(html).toContain('src="https://assets.example.com/asset-uuid-1"');
  });

  it('sets width and height attributes', () => {
    const html = renderImage(makeImage({ width: 200, height: 150 }), ctx);
    expect(html).toContain('width="200"');
    expect(html).toContain('height="150"');
  });

  it('sets alt to empty string (decorative)', () => {
    const html = renderImage(makeImage(), ctx);
    expect(html).toContain('alt=""');
  });

  it('includes absolute positioning classes', () => {
    const html = renderImage(makeImage({ x: 10, y: 20, width: 200, height: 150 }), ctx);
    expect(html).toContain('absolute');
    expect(html).toContain('left-[10px]');
    expect(html).toContain('top-[20px]');
  });

  it('includes opacity class when opacity is set', () => {
    const html = renderImage(makeImage({ opacity: 0.5 }), ctx);
    expect(html).toContain('opacity-[50%]');
  });

  it('includes blend mode class', () => {
    const html = renderImage(makeImage({ blendMode: 'multiply' }), ctx);
    expect(html).toContain('mix-blend-multiply');
  });

  it('includes rotation in transform style when rotation is set', () => {
    const html = renderImage(makeImage({ rotation: 45 }), ctx);
    expect(html).toContain('rotate(-45deg)');
  });

  it('includes hidden class when hidden', () => {
    const html = renderImage(makeImage({ hidden: true }), ctx);
    expect(html).toContain('hidden');
  });

  it('calls resolveImageUrl with the metadata id', () => {
    const resolved: string[] = [];
    const testCtx: ConverterContext = {
      resolveImageUrl: (id) => {
        resolved.push(id);
        return `url-${id}`;
      },
    };
    renderImage(makeImage(), testCtx);
    expect(resolved).toContain('asset-uuid-1');
  });
});
