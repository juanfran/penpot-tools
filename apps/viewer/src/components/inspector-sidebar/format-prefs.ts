export type ColorFormat = 'hex' | 'rgb' | 'hsl';
export type UnitFormat = 'px' | 'rem' | 'em';

export const COLOR_FORMATS = ['hex', 'rgb', 'hsl'] as const;
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

function parseColor(s: string): RGBA | null {
  if (s.startsWith('#')) return parseHexColor(s);
  if (/^rgba?\(/i.test(s)) return parseRgbColor(s);
  if (/^hsla?\(/i.test(s)) return parseHslColor(s);
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

function formatColor(c: RGBA, format: ColorFormat): string {
  switch (format) {
    case 'hex':
      return formatHexColor(c);
    case 'rgb':
      return formatRgbColor(c);
    case 'hsl':
      return formatHslColor(c);
  }
}

export const COLOR_REGEX = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi;
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
