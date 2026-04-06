import { describe, it, expect } from 'vitest';
import {
  solidFillToClass,
  linearGradientToStyle,
  radialGradientToStyle,
  imageFillToStyle,
  fillsToOutput,
} from './fills';
import type { Fill, Gradient, HexColor } from '../../penpot.types';
import type { ConverterContext } from '../types';

const makeCtx = (
  resolveImageUrl = (id: string) => `https://assets.example.com/${id}`,
): ConverterContext => ({
  resolveImageUrl,
  tailwindMode: 'none',
});

describe('solidFillToClass', () => {
  it('returns empty string when fillColor is absent', () => {
    const fill: Fill = {};
    expect(solidFillToClass(fill)).toBe('');
  });

  it('returns bg-[hex] when fillColor is present and opacity is undefined', () => {
    const fill: Fill = { fillColor: '#ff0000' as HexColor };
    expect(solidFillToClass(fill)).toBe('bg-[#ff0000]');
  });

  it('returns bg-[hex] when fillColor is present and opacity is 1', () => {
    const fill: Fill = { fillColor: '#ff0000' as HexColor, fillOpacity: 1 };
    expect(solidFillToClass(fill)).toBe('bg-[#ff0000]');
  });

  it('returns bg-[rgba(...)] when fillColor and fractional opacity are present', () => {
    const fill: Fill = { fillColor: '#ff0000' as HexColor, fillOpacity: 0.5 };
    expect(solidFillToClass(fill)).toBe('bg-[rgba(255,_0,_0,_0.5)]');
  });

  it('returns bg-[rgba(...)] when opacity is 0', () => {
    const fill: Fill = { fillColor: '#000000' as HexColor, fillOpacity: 0 };
    expect(solidFillToClass(fill)).toBe('bg-[rgba(0,_0,_0,_0)]');
  });

  it('handles 3-digit hex color', () => {
    const fill: Fill = { fillColor: '#f00' as HexColor, fillOpacity: 0.5 };
    expect(solidFillToClass(fill)).toBe('bg-[rgba(255,_0,_0,_0.5)]');
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

  it('computes 90deg angle for left-to-right gradient (startX=0,startY=0 → endX=1,endY=0)', () => {
    const result = linearGradientToStyle(twoStopGradient);
    expect(result).toContain('90deg');
  });

  it('computes 180deg angle for top-to-bottom gradient (startX=0,startY=0 → endX=0,endY=1)', () => {
    const gradient: Gradient = {
      ...twoStopGradient,
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 1,
    };
    const result = linearGradientToStyle(gradient);
    expect(result).toContain('180deg');
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

  it('handles multi-stop gradients', () => {
    const gradient: Gradient = {
      ...twoStopGradient,
      stops: [
        { color: '#ff0000' as HexColor, opacity: 1, offset: 0 },
        { color: '#00ff00' as HexColor, opacity: 1, offset: 0.5 },
        { color: '#0000ff' as HexColor, opacity: 1, offset: 1 },
      ],
    };
    const result = linearGradientToStyle(gradient);
    expect(result).toContain('#ff0000 0%');
    expect(result).toContain('#00ff00 50%');
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
    const result = radialGradientToStyle(baseGradient);
    expect(result).toContain('at 50% 50%');
  });

  it('includes stop colors and offsets', () => {
    const result = radialGradientToStyle(baseGradient);
    expect(result).toContain('#ff0000 0%');
    expect(result).toContain('#0000ff 100%');
  });

  it('uses rgba for stops with fractional opacity', () => {
    const gradient: Gradient = {
      ...baseGradient,
      stops: [
        { color: '#ff0000' as HexColor, opacity: 0.5, offset: 0 },
        { color: '#0000ff' as HexColor, opacity: 1, offset: 1 },
      ],
    };
    const result = radialGradientToStyle(gradient);
    expect(result).toContain('rgba(255, 0, 0, 0.5) 0%');
    expect(result).toContain('#0000ff 100%');
  });

  it('defaults to centered circle when start and end are the same point', () => {
    const gradient: Gradient = {
      ...baseGradient,
      startX: 0.5,
      startY: 0.5,
      endX: 0.5,
      endY: 0.5,
    };
    const result = radialGradientToStyle(gradient);
    expect(result).toContain('at 50% 50%');
    expect(result).toMatch(/^background:\s*radial-gradient\(/);
  });

  it('handles off-center radial gradient', () => {
    const gradient: Gradient = {
      ...baseGradient,
      startX: 0.25,
      startY: 0.75,
      endX: 0.75,
      endY: 0.75,
    };
    const result = radialGradientToStyle(gradient);
    expect(result).toContain('at 25% 75%');
  });

  it('handles multi-stop gradients', () => {
    const gradient: Gradient = {
      ...baseGradient,
      stops: [
        { color: '#ff0000' as HexColor, opacity: 1, offset: 0 },
        { color: '#00ff00' as HexColor, opacity: 1, offset: 0.5 },
        { color: '#0000ff' as HexColor, opacity: 1, offset: 1 },
      ],
    };
    const result = radialGradientToStyle(gradient);
    expect(result).toContain('#ff0000 0%');
    expect(result).toContain('#00ff00 50%');
    expect(result).toContain('#0000ff 100%');
  });

  it('uses circle keyword in output', () => {
    const result = radialGradientToStyle(baseGradient);
    expect(result).toContain('circle');
  });
});

describe('imageFillToStyle', () => {
  it('returns background-image with resolved URL', () => {
    const fill: Fill = {
      fillImage: { id: 'abc-123', width: 100, height: 100, mtype: 'image/png' },
    };
    const result = imageFillToStyle(fill, makeCtx());
    expect(result).toContain(
      "background-image: url('https://assets.example.com/abc-123')",
    );
  });

  it('includes background-size: cover by default', () => {
    const fill: Fill = {
      fillImage: { id: 'abc-123', width: 100, height: 100, mtype: 'image/png' },
    };
    const result = imageFillToStyle(fill, makeCtx());
    expect(result).toContain('background-size: cover');
  });

  it('uses background-size: contain when keepAspectRatio is true', () => {
    const fill: Fill = {
      fillImage: {
        id: 'abc-123',
        width: 100,
        height: 100,
        mtype: 'image/png',
        keepAspectRatio: true,
      },
    };
    const result = imageFillToStyle(fill, makeCtx());
    expect(result).toContain('background-size: contain');
    expect(result).not.toContain('cover');
  });

  it('includes background-position: center', () => {
    const fill: Fill = {
      fillImage: { id: 'abc-123', width: 100, height: 100, mtype: 'image/png' },
    };
    const result = imageFillToStyle(fill, makeCtx());
    expect(result).toContain('background-position: center');
  });

  it('includes background-repeat: no-repeat', () => {
    const fill: Fill = {
      fillImage: { id: 'abc-123', width: 100, height: 100, mtype: 'image/png' },
    };
    const result = imageFillToStyle(fill, makeCtx());
    expect(result).toContain('background-repeat: no-repeat');
  });

  it('returns empty string when fillImage is absent', () => {
    const fill: Fill = {};
    const result = imageFillToStyle(fill, makeCtx());
    expect(result).toBe('');
  });

  it('calls resolveImageUrl with the fillImage id', () => {
    let capturedId = '';
    const ctx = makeCtx((id) => {
      capturedId = id;
      return `url-for-${id}`;
    });
    const fill: Fill = {
      fillImage: {
        id: 'img-456',
        width: 200,
        height: 150,
        mtype: 'image/jpeg',
      },
    };
    imageFillToStyle(fill, ctx);
    expect(capturedId).toBe('img-456');
  });

  it('escapes single quotes in the URL', () => {
    const fill: Fill = {
      fillImage: {
        id: "id-with'-quote",
        width: 10,
        height: 10,
        mtype: 'image/png',
      },
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
    fillImage: { id: 'img-1', width: 100, height: 100, mtype: 'image/png' },
  };

  it('returns empty output for null', () => {
    expect(fillsToOutput(null, makeCtx())).toEqual({ classes: '', style: '' });
  });

  it('returns empty output for undefined', () => {
    expect(fillsToOutput(undefined, makeCtx())).toEqual({
      classes: '',
      style: '',
    });
  });

  it('returns empty output for empty array', () => {
    expect(fillsToOutput([], makeCtx())).toEqual({ classes: '', style: '' });
  });

  it('returns empty output for fill with no content', () => {
    expect(fillsToOutput([{}], makeCtx())).toEqual({ classes: '', style: '' });
  });

  it('single solid fill returns class, no style', () => {
    const result = fillsToOutput([solidRed], makeCtx());
    expect(result.classes).toBe('bg-[#ff0000]');
    expect(result.style).toBe('');
  });

  it('single linear gradient returns style, no class', () => {
    const result = fillsToOutput([linearGrad], makeCtx());
    expect(result.classes).toBe('');
    expect(result.style).toMatch(/background:\s*linear-gradient\(/);
  });

  it('single radial gradient returns style, no class', () => {
    const radialFill: Fill = {
      fillColorGradient: {
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
      },
    };
    const result = fillsToOutput([radialFill], makeCtx());
    expect(result.classes).toBe('');
    expect(result.style).toMatch(/background:\s*radial-gradient\(/);
  });

  it('single image fill returns style, no class', () => {
    const result = fillsToOutput([imageFill], makeCtx());
    expect(result.classes).toBe('');
    expect(result.style).toContain('background-image:');
    expect(result.style).toContain("url('https://assets.example.com/img-1')");
  });

  it('multiple solid fills: layers via background-image gradient trick, no class', () => {
    const solidBlue: Fill = {
      fillColor: '#0000ff' as HexColor,
      fillOpacity: 0.5,
    };
    const result = fillsToOutput([solidRed, solidBlue], makeCtx());
    // Must emit background-image with both colors as gradient layers
    expect(result.style).toContain('background-image:');
    expect(result.style).toContain('#ff0000');
    expect(result.style).toContain('rgba(0, 0, 255, 0.5)');
  });

  it('gradient + solid fill: combined as layered backgrounds', () => {
    const result = fillsToOutput([linearGrad, solidRed], makeCtx());
    expect(result.style).toContain('background-image:');
    expect(result.style).toContain('linear-gradient(');
    expect(result.style).toContain('#ff0000');
  });

  it('image + solid fill: combined as layered backgrounds', () => {
    const result = fillsToOutput([imageFill, solidRed], makeCtx());
    expect(result.style).toContain('background-image:');
    expect(result.style).toContain("url('https://assets.example.com/img-1')");
    expect(result.style).toContain('#ff0000');
  });

  it('multiple image fills: comma-separated layers in order (first = topmost)', () => {
    const imageFill2: Fill = {
      fillImage: { id: 'img-2', width: 50, height: 50, mtype: 'image/jpeg' },
    };
    const result = fillsToOutput([imageFill, imageFill2], makeCtx());
    expect(result.style).toContain('background-image:');
    const imgValue =
      result.style.match(/background-image:\s*([^;]+)/)?.[1] ?? '';
    // img-1 should appear before img-2 (topmost layer first)
    expect(imgValue.indexOf('img-1')).toBeLessThan(imgValue.indexOf('img-2'));
  });

  it('multiple fills: background-size has same count as background-image layers', () => {
    const imageFill2: Fill = {
      fillImage: {
        id: 'img-2',
        width: 50,
        height: 50,
        mtype: 'image/jpeg',
        keepAspectRatio: true,
      },
    };
    const result = fillsToOutput([imageFill, imageFill2], makeCtx());
    const bgImage =
      result.style.match(/background-image:\s*([^;]+)/)?.[1] ?? '';
    const bgSize = result.style.match(/background-size:\s*([^;]+)/)?.[1] ?? '';
    const imageCount = bgImage.split(',').length;
    const sizeCount = bgSize.split(',').length;
    expect(imageCount).toBe(sizeCount);
  });
});
