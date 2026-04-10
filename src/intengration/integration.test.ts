import { describe, it, expect } from 'vitest';
import { convertShape } from '../converter/index';
import type { ConverterContext } from '../converter/index';
import { getExpected, getPage } from './utils';

const ctx: ConverterContext = {
  resolveImageUrl: (id) => `https://assets.example.com/${id}`,
};

describe('integration', () => {
  it('basic', async () => {
    const page1 = getPage('example1');
    const shape = page1.objects['00000000-0000-0000-0000-000000000000'];
    const { html } = await convertShape(shape, page1.objects, ctx);

    const expectedHtml = getExpected('example1');

    expect(html.trim()).toBe(expectedHtml);
  });

  it('svg group renders as <svg> with viewBox', async () => {
    const page = getPage('svg-group');
    const shape = page.objects['183a99e5-79eb-8075-8007-d6f23cf397ee'];
    const { html } = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('svg-group');

    expect(html.trim()).toBe(expectedHtml);
  });

  it('card group positions children relative to parent, not page', async () => {
    const page = getPage('card');
    const shape = page.objects['5526cb94-722e-8010-8007-d712339272fd'];
    const { html } = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('card');

    expect(html.trim()).toBe(expectedHtml);
  });

  it('grid frame with stroke, shadow, overflow and padding', async () => {
    const page = getPage('grid-stroke-shadow-overflow');
    const shape = page.objects['4300202f-9c79-80a5-8007-d842dc435658'];
    const { html } = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('grid-stroke-shadow-overflow');

    expect(html.trim()).toBe(expectedHtml);
  });

  it('design tokens render as CSS custom properties', async () => {
    const page = getPage('tokens');
    const shape = page.objects['4300202f-9c79-80a5-8007-d85d33499c1b'];
    const { html } = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('tokens');

    expect(html.trim()).toBe(expectedHtml);
  });

  it('rect with fillImage renders as Tailwind bg-[url(...)] classes', async () => {
    const page = getPage('image-fill');
    const shape = page.objects['0d3e2d55-6b68-8009-8007-d9885486fad8'];
    const { html } = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('image-fill');

    expect(html.trim()).toBe(expectedHtml);
  });

  it('button with inner stroke renders border classes on rect', async () => {
    const page = getPage('button-stroke');
    const shape = page.objects['eaa1384c-05db-801a-8007-d98c8c7c6455'];
    const { html } = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('button-stroke');

    expect(html.trim()).toBe(expectedHtml);
  });

  it('returns fonts used in the shape', async () => {
    const page1 = getPage('example1');
    const shape = page1.objects['00000000-0000-0000-0000-000000000000'];
    const { fonts } = await convertShape(shape, page1.objects, ctx);

    expect(Array.isArray(fonts)).toBe(true);
    for (const font of fonts) {
      expect(typeof font.fontFamily).toBe('string');
    }
  });
});
