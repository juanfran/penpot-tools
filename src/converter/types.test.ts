import { describe, it, expect } from 'vitest';
import { convertPage, convertShape } from './types';
import type { Page, Shape } from '../penpot.types';
import type { ConverterContext } from './types';

const ctx: ConverterContext = {
  resolveImageUrl: (id) => `https://example.com/images/${id}`,
  tailwindMode: 'cdn',
};

const minimalPage: Page = {
  id: 'page-1' as Page['id'],
  name: 'Test Page',
  objects: {},
};

const minimalShape: Shape = {
  id: 'shape-1' as Shape['id'],
  name: 'Rect',
  type: 'rect',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  selrect: { x: 0, y: 0, width: 100, height: 100 },
  points: [],
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  parentId: 'page-1' as Shape['id'],
  frameId: 'page-1' as Shape['id'],
};

describe('convertPage', () => {
  it("throws 'not implemented'", () => {
    expect(() => convertPage(minimalPage, ctx)).toThrow('not implemented');
  });
});

describe('convertShape', () => {
  it("throws 'not implemented'", () => {
    expect(() => convertShape(minimalShape, {}, ctx)).toThrow(
      'not implemented',
    );
  });
});
