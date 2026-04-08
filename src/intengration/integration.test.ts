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
});
