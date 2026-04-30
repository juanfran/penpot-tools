import '@vitest/browser/matchers';
import { describe, it, expect } from 'vitest';
import { convertShape } from '../converter/index';
import type { ConverterContext } from '../converter/index';
import { extractTokens } from '../converter/tokens';
import { getPage } from './utils';
import { mount } from './mount';

// Deterministic placeholder for image fills so screenshots don't depend on network.
// 1x1 PNG with a neutral gray pixel.
const PLACEHOLDER_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC';

const ctx: ConverterContext = {
  resolveImageUrl: () => PLACEHOLDER_IMAGE,
  format: false,
};

describe('integration', () => {
  it('basic', async () => {
    const page1 = getPage('example1');
    const shape = page1.objects['00000000-0000-0000-0000-000000000000'];
    const { html, fonts } = await convertShape(shape, page1.objects, ctx);
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('example1');
  });

  it('svg group renders as <svg> with viewBox', async () => {
    const page = getPage('svg-group');
    const shape = page.objects['183a99e5-79eb-8075-8007-d6f23cf397ee'];
    const { html, fonts } = await convertShape(shape, page.objects, ctx);
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('svg-group');
  });

  it('card group positions children relative to parent, not page', async () => {
    const page = getPage('card');
    const shape = page.objects['5526cb94-722e-8010-8007-d712339272fd'];
    const { html, fonts } = await convertShape(shape, page.objects, ctx);
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('card');
  });

  it('grid frame with stroke, shadow, overflow and padding', async () => {
    const page = getPage('grid-stroke-shadow-overflow');
    const shape = page.objects['4300202f-9c79-80a5-8007-d842dc435658'];
    const { html, fonts } = await convertShape(shape, page.objects, ctx);
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('grid-stroke-shadow-overflow');
  });

  it('design tokens render as CSS custom properties', async () => {
    const page = getPage('tokens');
    const shape = page.objects['4300202f-9c79-80a5-8007-d85d33499c1b'];
    const tokens = extractTokens(page.objects);
    const { html, fonts } = await convertShape(shape, page.objects, { ...ctx, tokens });
    const el = await mount({ html, fonts, tokens });
    await expect(el).toMatchScreenshot('tokens');
  });

  it('rect with fillImage and keepAspectRatio:true uses background-size: cover, not contain', async () => {
    const page = getPage('image-fill-cover');
    const shape = page.objects['a1b2c3d4-0000-0000-0000-000000000001'];
    const { html, fonts } = await convertShape(shape, page.objects, ctx);
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('image-fill-cover');
  });

  it('rect with fillImage renders as inline background-image style', async () => {
    const page = getPage('image-fill');
    const shape = page.objects['0d3e2d55-6b68-8009-8007-d9885486fad8'];
    const { html, fonts } = await convertShape(shape, page.objects, ctx);
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('image-fill');
  });

  it('svg group with stroke-only paths renders strokes', async () => {
    const page = getPage('icon-menu');
    const shape = page.objects['eaa1384c-05db-801a-8007-d98e7c8afad3'];
    const { html, fonts } = await convertShape(shape, page.objects, ctx);
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('icon-menu');
  });

  it('button with inner stroke renders border style on rect', async () => {
    const page = getPage('button-stroke');
    const shape = page.objects['eaa1384c-05db-801a-8007-d98c8c7c6455'];
    const { html, fonts } = await convertShape(shape, page.objects, ctx);
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('button-stroke');
  });

  it('flex auto-sized children emit own explicit height, not 100%', async () => {
    const page = getPage('flex-auto-sizing');
    const shape = page.objects['col-container'];
    const { html, fonts } = await convertShape(shape, page.objects, ctx);
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('flex-auto-sizing');
  });

  it('absolutely-placed flex item uses parent-relative coordinates', async () => {
    const page = getPage('flex-absolute-item');
    const shape = page.objects['flex-container'];
    const { html, fonts } = await convertShape(shape, page.objects, ctx);
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('flex-absolute-item');
  });

  it('flex column children render in top-to-bottom visual order', async () => {
    const page = getPage('flex-column-order');
    const shape = page.objects['col-container'];
    const { html, fonts } = await convertShape(shape, page.objects, ctx);
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('flex-column-order');
  });

  it('text with growType auto-width gets white-space: nowrap, auto-height does not', async () => {
    const page = getPage('text-grow-type');
    const shape = page.objects['frame-a'];
    const { html, fonts } = await convertShape(shape, page.objects, ctx);
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('text-grow-type');
  });

  it('row-reverse and column-reverse emit flex-row/flex-col and preserve visual child order', async () => {
    const page = getPage('flex-reverse-direction');

    const rowShape = page.objects['row-rev-panel'];
    const row = await convertShape(rowShape, page.objects, ctx);
    const rowEl = await mount({ html: row.html, fonts: row.fonts });
    await expect(rowEl).toMatchScreenshot('flex-reverse-direction-row');

    const colShape = page.objects['col-rev-panel'];
    const col = await convertShape(colShape, page.objects, ctx);
    const colEl = await mount({ html: col.html, fonts: col.fonts });
    await expect(colEl).toMatchScreenshot('flex-reverse-direction-col');
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
    const page = getPage('flex-fill-cross-overflow');
    const shape = page.objects['outer-row'];
    const { html, fonts } = await convertShape(shape, page.objects, ctx);
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('flex-fill-cross-overflow');
  });

  it('path-image-fill', async () => {
    const page = getPage('path-image-fill');
    const shape = page.objects['eaa1384c-05db-801a-8007-d9937f4003e2'];
    const { html, fonts } = await convertShape(shape, page.objects, ctx);
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('path-image-fill');
  });

  it('group with text + arrow-path renders text and full-width arrow with tip', async () => {
    const page = getPage('group-text-arrow');
    const shape = page.objects['00000000-0000-0000-0000-000000000000'];
    const { html, fonts } = await convertShape(shape, page.objects, ctx);
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('group-text-arrow');
  });

  it('flex column path line with null width/height and hSizing fill renders at selrect width', async () => {
    const page = getPage('flex-column-path-line');
    const shape = page.objects['00000000-0000-0000-0000-000000000000'];
    const { html, fonts } = await convertShape(shape, page.objects, ctx);
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('flex-column-path-line');
  });

  it('FAB with shadow on frame and icon flex-child with padding+margin — shadow follows rounded bg, icon visible', async () => {
    const page = getPage('fab-shadow-and-icon');
    const shape = page.objects['fab-root'];
    const { html, fonts } = await convertShape(shape, page.objects, ctx);
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('fab-shadow-and-icon');
  });

  it('fix-sized flex item ignores stale layoutItemMin* so the item keeps its declared size', async () => {
    const page = getPage('flex-item-stale-min-size');
    const shape = page.objects['toolbar'];
    const { html, fonts } = await convertShape(shape, page.objects, ctx);
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('flex-item-stale-min-size');
  });

  it('group inside flex-col gets position: relative so its absolute children stay inside', async () => {
    const page = getPage('flex-group-absolute-children');
    const shape = page.objects['col-card'];
    const { html, fonts } = await convertShape(shape, page.objects, ctx);
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('flex-group-absolute-children');
  });

  it('flex row flagged nowrap whose children are stored across rows wraps in CSS', async () => {
    // Penpot's data sometimes keeps layoutWrapType:"nowrap" while its canvas
    // laid the children across multiple rows; the converter should trust the
    // stored child positions and emit flex-wrap: wrap so the rendered output
    // matches the design.
    const page = getPage('flex-wrap-from-positions');
    const shape = page.objects['chip-bar'];
    const { html, fonts } = await convertShape(shape, page.objects, ctx);
    expect(html).toContain('flex-wrap: wrap;');
    // Children with vSizing: fill on a wrapping row must not get height: 100%
    // (which resolves to the parent's full inner height — 60px here — instead
    // of the wrapped row line, leaving each chip dramatically too tall).
    expect(html).toContain('height: 24px;');
    expect(html).not.toContain('height: 100%;');
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('flex-wrap-from-positions');
  });

  it('text leaves with HTML special chars escape, so a code snippet renders as text on separate lines', async () => {
    // Repro: a code preview with literal `<section…>`, `&`, `</section>`. If
    // the renderer leaves the angle brackets unescaped, the browser parses
    // them as real tags, swallows the surrounding markup, and collapses the
    // sibling lines into a single line.
    const page = getPage('text-html-escape');
    const shape = page.objects['snippet-card'];
    const { html, fonts } = await convertShape(shape, page.objects, ctx);
    expect(html).toContain('&lt;section');
    expect(html).toContain('&amp;');
    expect(html).not.toMatch(/<section[^>]*data-tag/);
    const el = await mount({ html, fonts });
    await expect(el).toMatchScreenshot('text-html-escape');
  });

  it('fillOpacity:0 overrides appliedTokens.fill and emits no background', async () => {
    const page = getPage('transparent-fill-token');
    const rootShape = page.objects['root-frame'];
    const tokens = extractTokens(page.objects);
    const { html, fonts } = await convertShape(rootShape, page.objects, { ...ctx, tokens });
    const el = await mount({ html, fonts, tokens });
    await expect(el).toMatchScreenshot('transparent-fill-token');
  });
});
