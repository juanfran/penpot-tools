export type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'oklch';
export type UnitFormat = 'px' | 'rem' | 'em';

export const COLOR_FORMATS = ['hex', 'rgb', 'hsl', 'oklch'] as const;
export const UNIT_FORMATS = ['px', 'rem', 'em'] as const;
const BASE_FONT_PX = 16;

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseHexColor(s: string): RGBA | null {
  const m = /^#([0-9a-fA-F]{3,8})$/.exec(s);
  if (!m) return null;
  const hex = m[1];
  const len = hex.length;
  if (len === 3 || len === 4) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    const a = len === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
    return { r, g, b, a };
  }
  if (len === 6 || len === 8) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = len === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  return null;
}

function parseChannel(raw: string): number {
  return raw.endsWith('%') ? (parseFloat(raw) * 255) / 100 : parseFloat(raw);
}

function parseAlpha(raw: string | undefined): number {
  if (raw === undefined) return 1;
  return raw.endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw);
}

function parseRgbColor(s: string): RGBA | null {
  const m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (!m) return null;
  const parts = m[1]
    .replace(/\//g, ',')
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  return {
    r: parseChannel(parts[0]),
    g: parseChannel(parts[1]),
    b: parseChannel(parts[2]),
    a: parseAlpha(parts[3]),
  };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hue = (((h % 360) + 360) % 360) / 60;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hue % 2) - 1));
  let r = 0,
    g = 0,
    b = 0;
  if (hue < 1) [r, g, b] = [c, x, 0];
  else if (hue < 2) [r, g, b] = [x, c, 0];
  else if (hue < 3) [r, g, b] = [0, c, x];
  else if (hue < 4) [r, g, b] = [0, x, c];
  else if (hue < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rN = r / 255,
    gN = g / 255,
    bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rN) h = (gN - bN) / d + (gN < bN ? 6 : 0);
    else if (max === gN) h = (bN - rN) / d + 2;
    else h = (rN - gN) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

function parseHslColor(s: string): RGBA | null {
  const m = /^hsla?\(([^)]+)\)$/i.exec(s);
  if (!m) return null;
  const parts = m[1]
    .replace(/\//g, ',')
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  const h = parseFloat(parts[0]);
  const sat = parseFloat(parts[1]) / 100;
  const lig = parseFloat(parts[2]) / 100;
  const { r, g, b } = hslToRgb(h, sat, lig);
  return { r, g, b, a: parseAlpha(parts[3]) };
}

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const x = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return x * 255;
}

function rgbToOklch(r: number, g: number, b: number): { l: number; c: number; h: number } {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const c2 = Math.sqrt(A * A + B * B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c: c2, h };
}

function oklchToRgb(L: number, C: number, h: number): { r: number; g: number; b: number } {
  const hr = (h * Math.PI) / 180;
  const A = C * Math.cos(hr);
  const B = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = L - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = L - 0.0894841775 * A - 1.291485548 * B;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return { r: linearToSrgb(lr), g: linearToSrgb(lg), b: linearToSrgb(lb) };
}

function parseOklchPart(raw: string, scale: number): number {
  return raw.endsWith('%') ? (parseFloat(raw) / 100) * scale : parseFloat(raw);
}

function parseOklchColor(s: string): RGBA | null {
  const m = /^oklch\(([^)]+)\)$/i.exec(s);
  if (!m) return null;
  const parts = m[1]
    .replace(/\//g, ',')
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  const L = parseOklchPart(parts[0], 1);
  const C = parseOklchPart(parts[1], 0.4);
  const h = parseFloat(parts[2]);
  const { r, g, b } = oklchToRgb(L, C, h);
  return { r, g, b, a: parseAlpha(parts[3]) };
}

function parseColor(s: string): RGBA | null {
  if (s.startsWith('#')) return parseHexColor(s);
  if (/^rgba?\(/i.test(s)) return parseRgbColor(s);
  if (/^hsla?\(/i.test(s)) return parseHslColor(s);
  if (/^oklch\(/i.test(s)) return parseOklchColor(s);
  return null;
}

function to2Hex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');
}

function formatHexColor(c: RGBA): string {
  const base = `#${to2Hex(c.r)}${to2Hex(c.g)}${to2Hex(c.b)}`;
  return c.a < 1 ? `${base}${to2Hex(c.a * 255)}` : base;
}

function roundChannel(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function formatRgbColor(c: RGBA): string {
  const r = roundChannel(c.r);
  const g = roundChannel(c.g);
  const b = roundChannel(c.b);
  if (c.a < 1) return `rgba(${r}, ${g}, ${b}, ${+c.a.toFixed(3)})`;
  return `rgb(${r}, ${g}, ${b})`;
}

function formatHslColor(c: RGBA): string {
  const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
  const hh = Math.round(h);
  const ss = Math.round(s * 100);
  const ll = Math.round(l * 100);
  if (c.a < 1) return `hsla(${hh}, ${ss}%, ${ll}%, ${+c.a.toFixed(3)})`;
  return `hsl(${hh}, ${ss}%, ${ll}%)`;
}

function formatOklchColor(c: RGBA): string {
  const { l, c: chroma, h } = rgbToOklch(c.r, c.g, c.b);
  const ll = +(l * 100).toFixed(2);
  const cc = +chroma.toFixed(4);
  const hh = chroma < 1e-4 ? 0 : +h.toFixed(2);
  if (c.a < 1) return `oklch(${ll}% ${cc} ${hh} / ${+c.a.toFixed(3)})`;
  return `oklch(${ll}% ${cc} ${hh})`;
}

function formatColor(c: RGBA, format: ColorFormat): string {
  switch (format) {
    case 'hex':
      return formatHexColor(c);
    case 'rgb':
      return formatRgbColor(c);
    case 'hsl':
      return formatHslColor(c);
    case 'oklch':
      return formatOklchColor(c);
  }
}

export const COLOR_REGEX =
  /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)/gi;
const PX_REGEX = /(-?\d*\.?\d+)px\b/g;

function trimTrailingZeros(n: number): string {
  return String(+n.toFixed(4));
}

export function transformValue(
  value: string,
  colorFormat: ColorFormat,
  unitFormat: UnitFormat,
): string {
  let out = value.replace(COLOR_REGEX, (match) => {
    const parsed = parseColor(match);
    return parsed ? formatColor(parsed, colorFormat) : match;
  });
  if (unitFormat !== 'px') {
    out = out.replace(PX_REGEX, (_m, n: string) => {
      const px = parseFloat(n);
      if (px === 0) return `0${unitFormat}`;
      return `${trimTrailingZeros(px / BASE_FONT_PX)}${unitFormat}`;
    });
  }
  return out;
}
