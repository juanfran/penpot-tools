import type { Fill, Gradient, GradientStop, HexColor } from '@penpot-tools/converter/types';
import { parseColor } from '../build/css';

/**
 * Browsers serialize `getComputedStyle(...).backgroundImage` as a canonical
 * form: `linear-gradient(<angle>, <stops>)` (with `<angle>` normalized when
 * the author used `to <side>`), `radial-gradient(<shape> at <pos>, <stops>)`,
 * or `none`.
 *
 * We translate that back into a Penpot `Gradient` with `startX/Y / endX/Y` in
 * 0..1 unit space, mirroring the inverse trig used by the converter:
 *   `atan2(dx, -dy) === radians(cssAngle)`
 *   ⇒ dx = sin(angle), dy = -cos(angle)
 * and we project that direction across the unit box centred at (0.5, 0.5).
 */

const TWO_PI = Math.PI * 2;

const KEYWORD_DEG: Record<string, number> = {
  top: 0,
  bottom: 180,
  left: 270,
  right: 90,
  'top right': 45,
  'right top': 45,
  'bottom right': 135,
  'right bottom': 135,
  'bottom left': 225,
  'left bottom': 225,
  'top left': 315,
  'left top': 315,
};

function angleToRadians(angleStr: string): number {
  const m = angleStr.match(/^(-?\d+(?:\.\d+)?)(deg|rad|turn)?$/);
  if (!m) return 0;
  const value = Number(m[1]);
  const unit = m[2] ?? 'deg';
  if (unit === 'rad') return value;
  if (unit === 'turn') return value * TWO_PI;
  return (value * Math.PI) / 180;
}

/** Split top-level commas (respect parens). */
function splitTopLevel(input: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of input) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function parseStop(part: string, fallbackOffset: number): GradientStop | null {
  const trimmed = part.trim();
  // Try "<color> <position>" — find the boundary by pulling the trailing token.
  const m = trimmed.match(/^(.+?)\s+(-?\d+(?:\.\d+)?(?:%|px))?$/);
  let colorStr: string;
  let posStr: string | undefined;
  if (m && m[2]) {
    colorStr = m[1]!;
    posStr = m[2];
  } else {
    colorStr = trimmed;
  }
  const color = parseColor(colorStr.trim());
  if (!color) return null;
  let offset = fallbackOffset;
  if (posStr?.endsWith('%')) offset = Number(posStr.slice(0, -1)) / 100;
  // px positions can't be normalized without knowing the shape size — treat
  // them as fallback for now (rare in LLM output).
  return { color: color.hex, opacity: color.opacity, offset };
}

function parseStops(parts: string[]): GradientStop[] {
  const stops: GradientStop[] = [];
  for (let i = 0; i < parts.length; i++) {
    const fallback = parts.length === 1 ? 0 : i / (parts.length - 1);
    const stop = parseStop(parts[i]!, fallback);
    if (stop) stops.push(stop);
  }
  return stops;
}

/**
 * Project an angle (radians, CSS convention: 0 = up, clockwise) onto a unit
 * box centred at (0.5, 0.5). Keeps the magnitude at 1 — the `width` field on
 * the gradient is set to 1.
 */
function angleToEndpoints(angleRad: number): {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
} {
  const dx = Math.sin(angleRad);
  const dy = -Math.cos(angleRad);
  return {
    startX: 0.5 - 0.5 * dx,
    startY: 0.5 - 0.5 * dy,
    endX: 0.5 + 0.5 * dx,
    endY: 0.5 + 0.5 * dy,
  };
}

function parseLinearGradient(args: string): Gradient | null {
  const parts = splitTopLevel(args);
  if (parts.length === 0) return null;

  let angleRad = Math.PI; // default `to bottom` (CSS default)
  let stopParts = parts;
  const first = parts[0]!.trim();

  if (first.startsWith('to ')) {
    const dir = first.slice(3).trim();
    const deg = KEYWORD_DEG[dir];
    if (deg !== undefined) angleRad = (deg * Math.PI) / 180;
    stopParts = parts.slice(1);
  } else if (/^-?\d/.test(first) && /(deg|rad|turn)$/.test(first)) {
    angleRad = angleToRadians(first);
    stopParts = parts.slice(1);
  }

  const stops = parseStops(stopParts);
  if (stops.length === 0) return null;

  const { startX, startY, endX, endY } = angleToEndpoints(angleRad);
  return {
    type: 'linear',
    startX,
    startY,
    endX,
    endY,
    width: 1,
    stops: stops as [GradientStop, ...GradientStop[]],
  };
}

function parseRadialGradient(args: string): Gradient | null {
  const parts = splitTopLevel(args);
  if (parts.length === 0) return null;
  // First arg may be a shape/position spec (`circle at 50% 50%`). Everything
  // else is stops. We only need an approximate centre — Penpot reconstructs
  // the radius from `endX/Y - startX/Y`.
  let stopStart = 0;
  let cx = 0.5;
  let cy = 0.5;
  if (/(circle|ellipse|at\s)/i.test(parts[0]!)) {
    const atMatch = parts[0]!.match(/at\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/i);
    if (atMatch) {
      cx = Number(atMatch[1]) / 100;
      cy = Number(atMatch[2]) / 100;
    }
    stopStart = 1;
  }
  const stops = parseStops(parts.slice(stopStart));
  if (stops.length === 0) return null;
  return {
    type: 'radial',
    startX: cx,
    startY: cy,
    endX: cx + 0.5,
    endY: cy,
    width: 1,
    stops: stops as [GradientStop, ...GradientStop[]],
  };
}

/**
 * Parse a CSS computed `background-image` value into a Penpot gradient Fill.
 * Returns null when there's no gradient (e.g. plain `none`, or `url(...)`).
 */
export function gradientFillFromBackgroundImage(value: string): Fill | null {
  if (!value || value === 'none') return null;
  const trimmed = value.trim();
  let m = trimmed.match(/^linear-gradient\(([\s\S]+)\)$/);
  if (m) {
    const g = parseLinearGradient(m[1]!);
    return g ? { fillColorGradient: g } : null;
  }
  m = trimmed.match(/^radial-gradient\(([\s\S]+)\)$/);
  if (m) {
    const g = parseRadialGradient(m[1]!);
    return g ? { fillColorGradient: g } : null;
  }
  return null;
}

export type { HexColor };
