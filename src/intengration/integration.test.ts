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

  it('rect with fillImage and keepAspectRatio:true uses bg-cover, not bg-contain', async () => {
    // keepAspectRatio is a design-editor hint (locks shape proportions on resize),
    // not a background-size selector — image fills must always cover the shape.
    const page = getPage('image-fill-cover');
    const shape = page.objects['a1b2c3d4-0000-0000-0000-000000000001'];
    const { html } = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('image-fill-cover');

    expect(html.trim()).toBe(expectedHtml);
    expect(html).toContain('bg-cover');
    expect(html).not.toContain('bg-contain');
  });

  it('rect with fillImage renders as Tailwind bg-[url(...)] classes', async () => {
    const page = getPage('image-fill');
    const shape = page.objects['0d3e2d55-6b68-8009-8007-d9885486fad8'];
    const { html } = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('image-fill');

    expect(html.trim()).toBe(expectedHtml);
  });

  it('svg group with circle shapes renders circles and strokes', async () => {
    const page = getPage('graphic-social');
    const shape = page.objects['eaa1384c-05db-801a-8007-d9908cf18cbf'];
    const { html } = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('graphic-social');

    expect(html.trim()).toBe(expectedHtml);
  });

  it('svg group with stroke-only paths renders strokes', async () => {
    const page = getPage('icon-menu');
    const shape = page.objects['eaa1384c-05db-801a-8007-d98e7c8afad3'];
    const { html } = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('icon-menu');

    expect(html.trim()).toBe(expectedHtml);
  });

  it('button with inner stroke renders border classes on rect', async () => {
    const page = getPage('button-stroke');
    const shape = page.objects['eaa1384c-05db-801a-8007-d98c8c7c6455'];
    const { html } = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('button-stroke');

    expect(html.trim()).toBe(expectedHtml);
  });

  it('flex auto-sized children emit own explicit height, not h-full', async () => {
    // When a flex child has vSizing=auto, h-full would resolve to 100% of the
    // container's definite height (e.g. 400px) instead of the child's natural
    // height. The child must emit its own h-[N]px.
    const page = getPage('flex-auto-sizing');
    const shape = page.objects['col-container'];
    const { html } = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('flex-auto-sizing');

    expect(html.trim()).toBe(expectedHtml);
    // auto-height body-item must use its own height (120px), not fill the container
    expect(html).toContain('h-[120px]');
    expect(html).not.toMatch(/body-item[\s\S]*?h-full/);
  });

  it('absolutely-placed flex item uses parent-relative coordinates', async () => {
    // layoutItemAbsolute items were using raw canvas coordinates instead of
    // coordinates relative to the flex container's top-left corner.
    const page = getPage('flex-absolute-item');
    const shape = page.objects['flex-container'];
    const { html } = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('flex-absolute-item');

    expect(html.trim()).toBe(expectedHtml);
    // abs-item is at canvas (550, 580); container at (200, 300) → relative (350, 280)
    expect(html).toContain('left-[350px]');
    expect(html).toContain('top-[280px]');
    // must NOT contain the raw canvas coordinates
    expect(html).not.toContain('left-[550px]');
    expect(html).not.toContain('top-[580px]');
  });

  it('flex column children render in top-to-bottom visual order', async () => {
    // Penpot stores flex children in Z-order (back-to-front), which is the reverse
    // of visual flex order. The converter must reverse the shapes array so the
    // first child visually (top/left) appears first in the DOM.
    const page = getPage('flex-column-order');
    const shape = page.objects['col-container'];
    const { html } = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('flex-column-order');

    expect(html.trim()).toBe(expectedHtml);
    // item-a (top, red) must appear before item-c (bottom, blue)
    expect(html.indexOf('item-a')).toBeLessThan(html.indexOf('item-c'));
  });

  it('text with growType auto-width gets whitespace-nowrap, auto-height does not', async () => {
    // growType:'auto-width' means the text box expands horizontally — text must not wrap.
    // growType:'auto-height' is normal wrapping behaviour — no whitespace-nowrap.
    const page = getPage('text-grow-type');
    const shape = page.objects['frame-a'];
    const { html } = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('text-grow-type');

    expect(html.trim()).toBe(expectedHtml);
    expect(html).toContain('whitespace-nowrap');
    // only the auto-width element should have it — the auto-height one should not
    expect(html.indexOf('whitespace-nowrap')).toBe(html.lastIndexOf('whitespace-nowrap'));
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
