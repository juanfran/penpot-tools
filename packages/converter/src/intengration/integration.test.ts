import { describe, it, expect } from 'vitest';
import { convertShape } from '../converter/index';
import type { ConverterContext } from '../converter/index';
import { extractTokens } from '../converter/tokens';
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
    const tokens = extractTokens(page.objects);
    const { html } = await convertShape(shape, page.objects, { ...ctx, tokens });

    const expectedHtml = getExpected('tokens');

    expect(html.trim()).toBe(expectedHtml);
  });

  it('rect with fillImage and keepAspectRatio:true uses background-size: cover, not contain', async () => {
    // keepAspectRatio is a design-editor hint (locks shape proportions on resize),
    // not a background-size selector — image fills must always cover the shape.
    const page = getPage('image-fill-cover');
    const shape = page.objects['a1b2c3d4-0000-0000-0000-000000000001'];
    const { html } = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('image-fill-cover');

    expect(html.trim()).toBe(expectedHtml);
    expect(html).toContain('background-size: cover');
    expect(html).not.toContain('contain');
  });

  it('rect with fillImage renders as inline background-image style', async () => {
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

  it('button with inner stroke renders border style on rect', async () => {
    const page = getPage('button-stroke');
    const shape = page.objects['eaa1384c-05db-801a-8007-d98c8c7c6455'];
    const { html } = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('button-stroke');

    expect(html.trim()).toBe(expectedHtml);
  });

  it('flex auto-sized children emit own explicit height, not 100%', async () => {
    // When a flex child has vSizing=auto, height: 100% would resolve to the
    // container's definite height (e.g. 400px) instead of the child's natural
    // height. The child must emit its own explicit pixel height.
    const page = getPage('flex-auto-sizing');
    const shape = page.objects['col-container'];
    const { html } = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('flex-auto-sizing');

    expect(html.trim()).toBe(expectedHtml);
    // auto-height body-item must use its own height (120px), not fill the container
    expect(html).toContain('height: 120px');
    expect(html).not.toMatch(/body-item[\s\S]*?height: 100%/);
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
    expect(html).toContain('left: 350px');
    expect(html).toContain('top: 280px');
    // must NOT contain the raw canvas coordinates
    expect(html).not.toContain('left: 550px');
    expect(html).not.toContain('top: 580px');
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

  it('text with growType auto-width gets white-space: nowrap, auto-height does not', async () => {
    // growType:'auto-width' means the text box expands horizontally — text must not wrap.
    // growType:'auto-height' is normal wrapping behaviour — no white-space: nowrap.
    const page = getPage('text-grow-type');
    const shape = page.objects['frame-a'];
    const { html } = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('text-grow-type');

    expect(html.trim()).toBe(expectedHtml);
    expect(html).toContain('white-space: nowrap');
    // only the auto-width element should have it — the auto-height one should not
    expect(html.indexOf('white-space: nowrap')).toBe(html.lastIndexOf('white-space: nowrap'));
  });

  it('row-reverse and column-reverse emit flex-row/flex-col and preserve visual child order', async () => {
    // Penpot stores row-reverse/column-reverse children in visual order (leftmost/topmost
    // first in shapes[]), unlike regular row/column where children are in Z-order
    // (rightmost/bottommost first). Using flex-row-reverse with a reversal is doubly wrong:
    // single-child containers end up on the opposite side; multi-child containers
    // happen to cancel out but the CSS class is still incorrect.
    const page = getPage('flex-reverse-direction');

    // row-reverse: product-name (left) must come before price-badge (right) in DOM
    const rowShape = page.objects['row-rev-panel'];
    const { html: rowHtml } = await convertShape(rowShape, page.objects, ctx);
    const rowExpected = getExpected('flex-reverse-direction');
    expect(rowHtml.trim()).toBe(rowExpected);
    expect(rowHtml).toContain('flex-direction: row');
    expect(rowHtml).not.toContain('flex-direction: row-reverse');
    expect(rowHtml.indexOf('product-name')).toBeLessThan(rowHtml.indexOf('price-badge'));

    // column-reverse: info-header (top) must come before info-body (bottom) in DOM
    const colShape = page.objects['col-rev-panel'];
    const { html: colHtml } = await convertShape(colShape, page.objects, ctx);
    expect(colHtml).toContain('flex-direction: column');
    expect(colHtml).not.toContain('flex-direction: column-reverse');
    expect(colHtml.indexOf('info-header')).toBeLessThan(colHtml.indexOf('info-body'));
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

  it('column flex: fill hSizing child uses explicit px width to prevent overflow inflation', async () => {
    // Regression: a fill child in a column flex container with horizontal padding had
    // grandchildren with fixed widths equal to the container. Using width: 100% on the child
    // allowed browsers to inflate the container by the padding amount (e.g. 1657px → 1697px).
    // The fix: fill on the cross-axis (w in column) uses explicit width in px instead.
    const page = getPage('flex-fill-cross-overflow');
    const shape = page.objects['outer-row'];
    const { html } = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('flex-fill-cross-overflow');
    expect(html.trim()).toBe(expectedHtml);

    // fill-child (fill hSizing in column parent) must use explicit px, not width: 100%
    expect(html).toContain('width: 400px');
    expect(html).not.toMatch(/data-id="fill-child"[^>]*style="[^"]*width: 100%/);
  });

  it('path-image-fill', async () => {
    const page = getPage('path-image-fill');
    const shape = page.objects['eaa1384c-05db-801a-8007-d9937f4003e2'];
    const { html } = await convertShape(shape, page.objects, ctx);
    expect(html.trim()).toBe(getExpected('path-image-fill'));
  });

  it('fillOpacity:0 overrides appliedTokens.fill and emits no background', async () => {
    // A Penpot user can point a fill at a color token and then drop the fill's
    // opacity to 0 to hide it (e.g. a transparent close-button background that
    // still references a design token). The opacity wins over the token.
    const page = getPage('transparent-fill-token');
    const rootShape = page.objects['root-frame'];
    const tokens = extractTokens(page.objects);
    const { html } = await convertShape(rootShape, page.objects, { ...ctx, tokens });

    expect(html.trim()).toBe(getExpected('transparent-fill-token'));
    // Only the visible rect resolves to the token; the transparent one emits no background.
    expect(html).toContain('background-color: var(--button-bg)');
    const occurrences = html.match(/background-color/g) ?? [];
    expect(occurrences.length).toBe(1);
  });
});
