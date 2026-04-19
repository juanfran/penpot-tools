import { describe, it, expect } from 'vitest';
import {
  solidFillToStyle,
  linearGradientToStyle,
  radialGradientToStyle,
  imageFillToStyle,
  fillsToOutput,
} from './fills';
import type { Fill, Gradient, HexColor, Uuid } from '../../penpot.types';
import type { ConverterContext } from '../types';

const makeCtx = (
  resolveImageUrl = (id: string) => `https://assets.example.com/${id}`,
): ConverterContext => ({
  resolveImageUrl,
});

describe('solidFillToStyle', () => {
  it('returns empty string when fillColor is absent', () => {
    const fill: Fill = {};
    expect(solidFillToStyle(fill)).toBe('');
  });

  it('returns background-color with hex when fillColor is present and opacity is undefined', () => {
    const fill: Fill = { fillColor: '#ff0000' as HexColor };
    expect(solidFillToStyle(fill)).toBe('background-color: #ff0000;');
  });

  it('returns background-color with hex when fillColor is present and opacity is 1', () => {
    const fill: Fill = { fillColor: '#ff0000' as HexColor, fillOpacity: 1 };
    expect(solidFillToStyle(fill)).toBe('background-color: #ff0000;');
  });

  it('returns background-color with rgba when fillColor and fractional opacity are present', () => {
    const fill: Fill = { fillColor: '#ff0000' as HexColor, fillOpacity: 0.5 };
    expect(solidFillToStyle(fill)).toBe('background-color: rgba(255, 0, 0, 0.5);');
  });

  it('returns background-color with rgba when opacity is 0', () => {
    const fill: Fill = { fillColor: '#000000' as HexColor, fillOpacity: 0 };
    expect(solidFillToStyle(fill)).toBe('background-color: rgba(0, 0, 0, 0);');
  });
});

describe('linearGradientToStyle', () => {
  const twoStopGradient: Gradient = {
    type: 'linear',
    startX: 0,
    startY: 0,
    endX: 1,
    endY: 0,
    width: 1,
    stops: [
      { color: '#ff0000' as HexColor, opacity: 1, offset: 0 },
      { color: '#0000ff' as HexColor, opacity: 1, offset: 1 },
    ],
  };

  it('emits background: linear-gradient(...) property string', () => {
    const result = linearGradientToStyle(twoStopGradient);
    expect(result).toMatch(/^background:\s*linear-gradient\(/);
    expect(result).toMatch(/;$/);
  });

  it('computes 90deg angle for left-to-right gradient', () => {
    expect(linearGradientToStyle(twoStopGradient)).toContain('90deg');
  });

  it('computes 180deg angle for top-to-bottom gradient', () => {
    const gradient: Gradient = { ...twoStopGradient, startX: 0, startY: 0, endX: 0, endY: 1 };
    expect(linearGradientToStyle(gradient)).toContain('180deg');
  });

  it('includes stop colors and offsets', () => {
    const result = linearGradientToStyle(twoStopGradient);
    expect(result).toContain('#ff0000 0%');
    expect(result).toContain('#0000ff 100%');
  });

  it('uses rgba for stops with fractional opacity', () => {
    const gradient: Gradient = {
      ...twoStopGradient,
      stops: [
        { color: '#ff0000' as HexColor, opacity: 0.5, offset: 0 },
        { color: '#0000ff' as HexColor, opacity: 1, offset: 1 },
      ],
    };
    const result = linearGradientToStyle(gradient);
    expect(result).toContain('rgba(255, 0, 0, 0.5) 0%');
    expect(result).toContain('#0000ff 100%');
  });
});

describe('radialGradientToStyle', () => {
  const baseGradient: Gradient = {
    type: 'radial',
    startX: 0.5,
    startY: 0.5,
    endX: 1,
    endY: 0.5,
    width: 1,
    stops: [
      { color: '#ff0000' as HexColor, opacity: 1, offset: 0 },
      { color: '#0000ff' as HexColor, opacity: 1, offset: 1 },
    ],
  };

  it('emits background: radial-gradient(...) property string', () => {
    const result = radialGradientToStyle(baseGradient);
    expect(result).toMatch(/^background:\s*radial-gradient\(/);
    expect(result).toMatch(/;$/);
  });

  it('places center at startX%, startY%', () => {
    expect(radialGradientToStyle(baseGradient)).toContain('at 50% 50%');
  });

  it('includes circle keyword', () => {
    expect(radialGradientToStyle(baseGradient)).toContain('circle');
  });
});

describe('imageFillToStyle', () => {
  it('returns background-image style with resolved URL', () => {
    const fill: Fill = {
      fillImage: { id: 'abc-123' as Uuid, width: 100, height: 100, mtype: 'image/png' },
    };
    const result = imageFillToStyle(fill, makeCtx());
    expect(result).toContain("url('https://assets.example.com/abc-123')");
    expect(result).toContain('background-size: cover');
  });

  it('includes background-position: center', () => {
    const fill: Fill = {
      fillImage: { id: 'abc-123' as Uuid, width: 100, height: 100, mtype: 'image/png' },
    };
    expect(imageFillToStyle(fill, makeCtx())).toContain('background-position: center');
  });

  it('includes background-repeat: no-repeat', () => {
    const fill: Fill = {
      fillImage: { id: 'abc-123' as Uuid, width: 100, height: 100, mtype: 'image/png' },
    };
    expect(imageFillToStyle(fill, makeCtx())).toContain('background-repeat: no-repeat');
  });

  it('uses cover regardless of keepAspectRatio', () => {
    const fill: Fill = {
      fillImage: {
        id: 'abc-123' as Uuid,
        width: 100,
        height: 100,
        mtype: 'image/png',
        keepAspectRatio: true,
      },
    };
    const result = imageFillToStyle(fill, makeCtx());
    expect(result).toContain('cover');
    expect(result).not.toContain('contain');
  });

  it('returns empty string when fillImage is absent', () => {
    expect(imageFillToStyle({}, makeCtx())).toBe('');
  });

  it('calls resolveImageUrl with the fillImage id', () => {
    let capturedId = '';
    const ctx = makeCtx((id) => {
      capturedId = id;
      return `url-for-${id}`;
    });
    imageFillToStyle(
      { fillImage: { id: 'img-456' as Uuid, width: 200, height: 150, mtype: 'image/jpeg' } },
      ctx,
    );
    expect(capturedId).toBe('img-456');
  });

  it('escapes single quotes in the URL', () => {
    const fill: Fill = {
      fillImage: { id: "id-with'-quote" as Uuid, width: 10, height: 10, mtype: 'image/png' },
    };
    const ctx = makeCtx((id) => `https://example.com/${id}`);
    const result = imageFillToStyle(fill, ctx);
    expect(result).not.toMatch(/url\('[^']*'[^']*'\)/);
  });
});

describe('fillsToOutput', () => {
  const solidRed: Fill = { fillColor: '#ff0000' as HexColor };
  const linearGrad: Fill = {
    fillColorGradient: {
      type: 'linear',
      startX: 0,
      startY: 0,
      endX: 1,
      endY: 0,
      width: 1,
      stops: [
        { color: '#ff0000' as HexColor, opacity: 1, offset: 0 },
        { color: '#0000ff' as HexColor, opacity: 1, offset: 1 },
      ],
    },
  };
  const imageFill: Fill = {
    fillImage: { id: 'img-1' as Uuid, width: 100, height: 100, mtype: 'image/png' },
  };

  it('returns empty string for null', () => {
    expect(fillsToOutput(null, makeCtx())).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(fillsToOutput(undefined, makeCtx())).toBe('');
  });

  it('returns empty string for empty array', () => {
    expect(fillsToOutput([], makeCtx())).toBe('');
  });

  it('returns empty string for fill with no content', () => {
    expect(fillsToOutput([{}], makeCtx())).toBe('');
  });

  it('single solid fill returns background-color style', () => {
    const result = fillsToOutput([solidRed], makeCtx());
    expect(result).toBe('background-color: #ff0000;');
  });

  it('single linear gradient returns background style', () => {
    const result = fillsToOutput([linearGrad], makeCtx());
    expect(result).toMatch(/background:\s*linear-gradient\(/);
  });

  it('single image fill returns background-image style', () => {
    const result = fillsToOutput([imageFill], makeCtx());
    expect(result).toContain("url('https://assets.example.com/img-1')");
    expect(result).toContain('background-size: cover');
  });

  it('multiple solid fills: uses layered background-image', () => {
    const solidBlue: Fill = { fillColor: '#0000ff' as HexColor, fillOpacity: 0.5 };
    const result = fillsToOutput([solidRed, solidBlue], makeCtx());
    expect(result).toContain('background-image:');
    expect(result).toContain('#ff0000');
    expect(result).toContain('rgba(0, 0, 255, 0.5)');
  });

  it('gradient + solid fill: combined as layered backgrounds', () => {
    const result = fillsToOutput([linearGrad, solidRed], makeCtx());
    expect(result).toContain('background-image:');
    expect(result).toContain('linear-gradient(');
    expect(result).toContain('#ff0000');
  });

  it('image + solid fill: combined as layered backgrounds', () => {
    const result = fillsToOutput([imageFill, solidRed], makeCtx());
    expect(result).toContain('background-image:');
    expect(result).toContain("url('https://assets.example.com/img-1')");
    expect(result).toContain('#ff0000');
  });

  it('multiple image fills: reversed so top fill is first CSS layer', () => {
    const imageFill2: Fill = {
      fillImage: { id: 'img-2' as Uuid, width: 50, height: 50, mtype: 'image/jpeg' },
    };
    const result = fillsToOutput([imageFill, imageFill2], makeCtx());
    const imgValue = result.match(/background-image:\s*([^;]+)/)?.[1] ?? '';
    expect(imgValue.indexOf('img-2')).toBeLessThan(imgValue.indexOf('img-1'));
  });

  it('multiple fills: background-size has same count as background-image layers', () => {
    const imageFill2: Fill = {
      fillImage: {
        id: 'img-2' as Uuid,
        width: 50,
        height: 50,
        mtype: 'image/jpeg',
        keepAspectRatio: true,
      },
    };
    const result = fillsToOutput([imageFill, imageFill2], makeCtx());
    const bgImage = result.match(/background-image:\s*([^;]+)/)?.[1] ?? '';
    const bgSize = result.match(/background-size:\s*([^;]+)/)?.[1] ?? '';
    expect(bgImage.split(',').length).toBe(bgSize.split(',').length);
  });
});
