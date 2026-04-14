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
    const html = renderSvgRaw(makeSvgRaw({ id: 'my-svg' as Uuid }), ctx);
    expect(html).toContain('data-id="my-svg"');
  });

  it('embeds the raw SVG content inside the div', () => {
    const html = renderSvgRaw(makeSvgRaw({ content: '<svg><circle /></svg>' }), ctx);
    expect(html).toContain('<svg><circle /></svg>');
  });

  it('positions the div absolutely', () => {
    const html = renderSvgRaw(makeSvgRaw({ x: 10, y: 20, width: 100, height: 100 }), ctx);
    expect(html).toContain('absolute');
    expect(html).toContain('left-[10px]');
    expect(html).toContain('top-[20px]');
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

  it('includes opacity class when set', () => {
    const html = renderSvgRaw(makeSvgRaw({ opacity: 0.5 }), ctx);
    expect(html).toContain('opacity-[50%]');
  });

  it('includes blend mode class when set', () => {
    const html = renderSvgRaw(makeSvgRaw({ blendMode: 'multiply' }), ctx);
    expect(html).toContain('mix-blend-multiply');
  });

  it('includes hidden class when hidden', () => {
    const html = renderSvgRaw(makeSvgRaw({ hidden: true }), ctx);
    expect(html).toContain('hidden');
  });

  it('includes rotation in transform style when rotation is set', () => {
    const html = renderSvgRaw(makeSvgRaw({ rotation: 90 }), ctx);
    expect(html).toContain('rotate(-90deg)');
  });
});
