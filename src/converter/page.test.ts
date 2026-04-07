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

describe('renderPage', () => {
  it('renders a div with data-id of root frame', () => {
    const html = renderPage(makePage(), ctx);
    expect(html).toContain('data-id="root"');
  });

  it('root frame uses relative positioning', () => {
    const html = renderPage(makePage(), ctx);
    expect(html).toContain('relative');
    expect(html).not.toContain('absolute');
  });

  it('applies page background color from options', () => {
    const page = makePage({ options: { background: '#f0f0f0' as HexColor } });
    const html = renderPage(page, ctx);
    expect(html).toContain('#f0f0f0');
  });

  it('renders without background when options is absent', () => {
    const html = renderPage(makePage(), ctx);
    expect(html).toContain('data-id="root"');
  });

  it('includes width and height of root frame', () => {
    const html = renderPage(makePage(), ctx);
    expect(html).toContain('w-[1280px]');
    expect(html).toContain('h-[800px]');
  });
});
