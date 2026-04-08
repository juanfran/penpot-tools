import { describe, it, expect } from 'vitest';
import { renderPage } from './page';
import type { Page, FrameShape, Uuid, HexColor } from '../penpot.types';
import type { ConverterContext } from './types';

const ctx: ConverterContext = {
  resolveImageUrl: (id) => `https://assets.example.com/${id}`,
};

const makeRootFrame = (overrides: Partial<FrameShape> = {}): FrameShape => ({
  id: 'root' as Uuid,
  name: 'Page',
  type: 'frame',
  x: 0,
  y: 0,
  width: 1280,
  height: 800,
  shapes: [],
  selrect: { x: 0, y: 0, width: 1280, height: 800 },
  points: [],
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  parentId: 'root' as Uuid,
  frameId: 'root' as Uuid,
  ...overrides,
});

const makePage = (overrides: Partial<Page> = {}): Page => {
  const root = makeRootFrame();
  return {
    id: 'page-1' as Uuid,
    name: 'Page 1',
    objects: { root },
    ...overrides,
  };
};

const makeChildFrame = (overrides: Partial<FrameShape> = {}): FrameShape => ({
  id: 'child' as Uuid,
  name: 'Child Frame',
  type: 'frame',
  x: 10,
  y: 10,
  width: 200,
  height: 100,
  shapes: [],
  selrect: { x: 10, y: 10, width: 200, height: 100 },
  points: [],
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  parentId: 'root' as Uuid,
  frameId: 'root' as Uuid,
  ...overrides,
});

const makePageWithChild = (overrides: Partial<Page> = {}): Page => {
  const root = makeRootFrame({ shapes: ['child' as Uuid] });
  const child = makeChildFrame();
  return {
    id: 'page-1' as Uuid,
    name: 'Page 1',
    objects: { root, child },
    ...overrides,
  };
};

describe('renderPage', () => {
  it('does not render the root frame element itself', () => {
    const html = renderPage(makePage(), ctx);
    expect(html).not.toContain('data-id="root"');
  });

  it('renders children of the root frame', () => {
    const html = renderPage(makePageWithChild(), ctx);
    expect(html).toContain('data-id="child"');
  });

  it('returns empty string when root frame has no children', () => {
    const html = renderPage(makePage(), ctx);
    expect(html).toBe('');
  });

  it('applies page background color from options to children', () => {
    const page = makePageWithChild({
      options: { background: '#f0f0f0' as HexColor },
    });
    const html = renderPage(page, ctx);
    expect(html).toContain('data-id="child"');
  });
});
