import { describe, expect, it } from 'vitest';
import { gradientFillFromBackgroundImage } from './gradients';

describe('gradientFillFromBackgroundImage', () => {
  it('returns null for none / empty', () => {
    expect(gradientFillFromBackgroundImage('')).toBeNull();
    expect(gradientFillFromBackgroundImage('none')).toBeNull();
  });

  it('parses a 0deg linear gradient (start at bottom, end at top)', () => {
    const fill = gradientFillFromBackgroundImage('linear-gradient(0deg, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)');
    const g = fill!.fillColorGradient!;
    expect(g.type).toBe('linear');
    // 0deg points up: start = (0.5, 1) bottom, end = (0.5, 0) top
    expect(g.startX).toBeCloseTo(0.5);
    expect(g.startY).toBeCloseTo(1);
    expect(g.endX).toBeCloseTo(0.5);
    expect(g.endY).toBeCloseTo(0);
    expect(g.stops).toHaveLength(2);
    expect(g.stops[0].color).toBe('#FF0000');
    expect(g.stops[1].color).toBe('#0000FF');
    expect(g.stops[0].offset).toBe(0);
    expect(g.stops[1].offset).toBe(1);
  });

  it('parses a 90deg linear gradient (left → right)', () => {
    const fill = gradientFillFromBackgroundImage('linear-gradient(90deg, rgb(0,0,0), rgb(255,255,255))');
    const g = fill!.fillColorGradient!;
    expect(g.startX).toBeCloseTo(0);
    expect(g.startY).toBeCloseTo(0.5);
    expect(g.endX).toBeCloseTo(1);
    expect(g.endY).toBeCloseTo(0.5);
    // No explicit stops -> auto-distribute 0..1
    expect(g.stops[0].offset).toBe(0);
    expect(g.stops[1].offset).toBe(1);
  });

  it('preserves per-stop alpha through rgba()', () => {
    const fill = gradientFillFromBackgroundImage(
      'linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.35) 100%)',
    );
    const g = fill!.fillColorGradient!;
    expect(g.stops).toHaveLength(2);
    expect(g.stops[0].opacity).toBe(0);
    expect(g.stops[1].opacity).toBeCloseTo(0.35, 3);
  });

  it('parses a `to right` keyword as 90deg', () => {
    const fill = gradientFillFromBackgroundImage('linear-gradient(to right, rgb(0,0,0), rgb(255,255,255))');
    const g = fill!.fillColorGradient!;
    expect(g.startX).toBeCloseTo(0);
    expect(g.endX).toBeCloseTo(1);
  });

  it('parses turn units', () => {
    const fill = gradientFillFromBackgroundImage('linear-gradient(0.25turn, rgb(0,0,0), rgb(255,255,255))');
    const g = fill!.fillColorGradient!;
    // 0.25turn = 90deg → left-to-right
    expect(g.startX).toBeCloseTo(0);
    expect(g.endX).toBeCloseTo(1);
  });

  it('parses a radial gradient with explicit centre', () => {
    const fill = gradientFillFromBackgroundImage(
      'radial-gradient(circle at 25% 75%, rgb(255,0,0), rgb(0,0,0))',
    );
    const g = fill!.fillColorGradient!;
    expect(g.type).toBe('radial');
    expect(g.startX).toBeCloseTo(0.25);
    expect(g.startY).toBeCloseTo(0.75);
  });

  it('parses a radial gradient with implicit centre', () => {
    const fill = gradientFillFromBackgroundImage('radial-gradient(rgb(255,0,0), rgb(0,0,0))');
    const g = fill!.fillColorGradient!;
    expect(g.type).toBe('radial');
    expect(g.startX).toBeCloseTo(0.5);
    expect(g.startY).toBeCloseTo(0.5);
  });

  it('returns null for url() background-images', () => {
    expect(gradientFillFromBackgroundImage('url(http://x/y.png)')).toBeNull();
  });

  it('parses 3-stop gradients with explicit offsets', () => {
    const fill = gradientFillFromBackgroundImage(
      'linear-gradient(0deg, rgb(0,0,0) 0%, rgb(128,128,128) 50%, rgb(255,255,255) 100%)',
    );
    const g = fill!.fillColorGradient!;
    expect(g.stops).toHaveLength(3);
    expect(g.stops[1]!.offset).toBeCloseTo(0.5);
    expect(g.stops[1]!.color).toBe('#808080');
  });
});
