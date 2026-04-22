import { describe, it, expect } from 'vitest';
import { renderSvgRaw } from './svg-raw';
import type { SvgRawShape, Uuid } from '../../penpot.types';
import type { ConverterContext } from '../types';

const ctx: ConverterContext = {
  resolveImageUrl: (id) => `https://assets.example.com/${id}`,
};

const makeSvgRaw = (overrides: Partial<SvgRawShape> = {}): SvgRawShape => ({
  id: 'svg-raw-1' as Uuid,
  name: 'SvgRaw',
  type: 'svg-raw',
  content: '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" /></svg>',
  x: 10,
  y: 20,
  width: 100,
  height: 100,
  selrect: { x: 10, y: 20, width: 100, height: 100 },
  points: [],
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  parentId: 'parent-1' as Uuid,
  frameId: 'frame-1' as Uuid,
  ...overrides,
});

describe('renderSvgRaw', () => {
  it('renders a div wrapper', () => {
    const html = renderSvgRaw(makeSvgRaw(), ctx);
    expect(html).toMatch(/^<div/);
    expect(html).toMatch(/<\/div>$/);
  });

  it('includes data-id attribute', () => {
    expect(renderSvgRaw(makeSvgRaw({ id: 'my-svg' as Uuid }), ctx)).toContain('data-id="my-svg"');
  });

  it('includes data-type attribute', () => {
    expect(renderSvgRaw(makeSvgRaw(), ctx)).toContain('data-type="svg-raw"');
  });

  it('embeds the raw SVG content inside the div', () => {
    const html = renderSvgRaw(makeSvgRaw({ content: '<svg><circle /></svg>' }), ctx);
    expect(html).toContain('<svg><circle /></svg>');
  });

  it('positions the div absolutely using style', () => {
    const html = renderSvgRaw(makeSvgRaw({ x: 10, y: 20, width: 100, height: 100 }), ctx);
    expect(html).toContain('position: absolute;');
    expect(html).toContain('left: 10px;');
    expect(html).toContain('top: 20px;');
  });

  it('strips script elements from raw content for XSS safety', () => {
    const content = '<svg><script>alert("xss")</script><circle /></svg>';
    const html = renderSvgRaw(makeSvgRaw({ content }), ctx);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert');
    expect(html).toContain('<circle />');
  });

  it('strips on* event attributes for XSS safety', () => {
    const content = '<svg><circle onclick="alert(1)" onmouseover="evil()" /></svg>';
    const html = renderSvgRaw(makeSvgRaw({ content }), ctx);
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('onmouseover');
    expect(html).toContain('<circle');
  });

  it('includes opacity style when set', () => {
    expect(renderSvgRaw(makeSvgRaw({ opacity: 0.5 }), ctx)).toContain('opacity: 0.5;');
  });

  it('includes blend mode style when set', () => {
    expect(renderSvgRaw(makeSvgRaw({ blendMode: 'multiply' }), ctx)).toContain(
      'mix-blend-mode: multiply;',
    );
  });

  it('includes display: none when hidden', () => {
    expect(renderSvgRaw(makeSvgRaw({ hidden: true }), ctx)).toContain('display: none;');
  });

  it('includes rotation in transform style when rotation is set', () => {
    expect(renderSvgRaw(makeSvgRaw({ rotation: 90 }), ctx)).toContain('rotate(-90deg)');
  });

  it('has no class attribute', () => {
    expect(renderSvgRaw(makeSvgRaw(), ctx)).not.toContain('class=');
  });

  it('serializes tree-node content into SVG markup', () => {
    const content = {
      tag: 'svg',
      attrs: { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24' },
      content: [
        { tag: 'circle', attrs: { cx: 12, cy: 12, r: 10, fill: 'red' } },
        { tag: 'g', content: [{ tag: 'rect', attrs: { width: 4, height: 4 } }] },
      ],
    };
    const html = renderSvgRaw(makeSvgRaw({ content }), ctx);
    expect(html).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">');
    expect(html).toContain('<circle cx="12" cy="12" r="10" fill="red" />');
    expect(html).toContain('<g><rect width="4" height="4" /></g>');
  });

  it('escapes attribute values in tree-node content', () => {
    const content = { tag: 'svg', attrs: { 'data-x': '"><script>alert(1)</script>' } };
    const html = renderSvgRaw(makeSvgRaw({ content }), ctx);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&quot;');
  });
});
