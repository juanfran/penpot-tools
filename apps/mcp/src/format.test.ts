import { describe, expect, it } from 'vitest';
import { describePageBundle, describeShapeBundle } from './format.ts';
import type { PageHtmlBundle, ShapeHtmlBundle } from './convert.ts';

const baseBundle: PageHtmlBundle = {
  pageName: 'Demo',
  html: '<div data-id="r" data-type="rect"></div>',
  tokensCss: ':root { --c: red; }',
  fontsUsed: [
    { family: 'Inter', weight: 400, italic: false },
    { family: 'Inter', weight: 500, italic: false },
    { family: 'Inter', weight: 700, italic: true },
    { family: 'JetBrains Mono', weight: 400, italic: false },
  ],
  buildFontsCss: async () => '@font-face { font-family: Inter; ... }',
};

describe('describePageBundle', () => {
  it('omits the @font-face CSS by default and shows a compact fontsUsed summary', () => {
    const out = describePageBundle(baseBundle, 'page');
    expect(out).toContain('## fontsUsed');
    expect(out).toContain('- Inter — 400, 500, 700i');
    expect(out).toContain('- JetBrains Mono — 400');
    expect(out).not.toContain('## fontsCss');
    expect(out).not.toContain('@font-face');
  });

  it('inlines the @font-face CSS when includeFontsCss=true and fontsCss is provided', () => {
    const out = describePageBundle(baseBundle, 'page', {
      includeFontsCss: true,
      fontsCss: '@font-face { font-family: Inter; src: url(...); }',
    });
    expect(out).toContain('## fontsCss');
    expect(out).toContain('@font-face { font-family: Inter; src: url(...); }');
  });

  it('skips the fontsUsed section when no fonts are in play', () => {
    const out = describePageBundle({ ...baseBundle, fontsUsed: [] }, 'page');
    expect(out).not.toContain('## fontsUsed');
  });

  it('still includes tokens and html', () => {
    const out = describePageBundle(baseBundle, 'page');
    expect(out).toContain('## tokensCss');
    expect(out).toContain(':root { --c: red; }');
    expect(out).toContain('## html');
    expect(out).toContain('<div data-id="r"');
  });
});

describe('describeShapeBundle', () => {
  it('uses the shape header and accepts the same opts', () => {
    const shapeBundle: ShapeHtmlBundle = {
      ...baseBundle,
      shapeId: 'abc',
      shapeName: 'Hero',
      shapeType: 'frame',
    };
    const out = describeShapeBundle(shapeBundle);
    expect(out).toContain('Shape "Hero" (frame, id abc)');
    expect(out).toContain('## fontsUsed');
    expect(out).not.toContain('## fontsCss');
  });
});
