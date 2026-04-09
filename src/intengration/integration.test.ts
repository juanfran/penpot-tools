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
    const html = await convertShape(shape, page1.objects, ctx);

    const expectedHtml = getExpected('example1');

    expect(html.trim()).toBe(expectedHtml);
  });

  it('svg group renders as <svg> with viewBox', async () => {
    const page = getPage('svg-group');
    const shape = page.objects['183a99e5-79eb-8075-8007-d6f23cf397ee'];
    const html = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('svg-group');

    expect(html.trim()).toBe(expectedHtml);
  });

  it('card group positions children relative to parent, not page', async () => {
    const page = getPage('card');
    const shape = page.objects['5526cb94-722e-8010-8007-d712339272fd'];
    const html = await convertShape(shape, page.objects, ctx);

    const expectedHtml = getExpected('card');

    expect(html.trim()).toBe(expectedHtml);
  });
});
