import type { Stroke, StrokeStyle } from '@penpot-tools/converter/types';
import type { PickedComputedStyle } from '../types';
import { parseColor, parsePx } from '../build/css';

const STROKE_STYLE: Record<string, StrokeStyle> = {
  solid: 'solid',
  dashed: 'dashed',
  dotted: 'dotted',
};

/**
 * Match the lengths-only portion of an outer-stroke `box-shadow`: `0 0 0 Npx`.
 * Chrome's computed `box-shadow` serializes the color at the START of the
 * entry (e.g. `rgb(...) 0px 0px 0px 3px`), so we extract the color separately
 * before testing this pattern.
 */
const OUTER_STROKE_LENGTHS_RE =
  /^\s*0(?:px)?\s+0(?:px)?\s+0(?:px)?\s+(-?\d+(?:\.\d+)?)px\s*$/;

export interface StrokeExtraction {
  strokes: Stroke[];
  /** box-shadow entries already consumed as strokes; pass to the shadow extractor to skip. */
  consumedShadowIndices: Set<number>;
}

/**
 * Split `box-shadow: ..., ..., ...` into individual entries while respecting
 * the parens of `rgb(...)` / `rgba(...)`.
 */
export function splitBoxShadowList(value: string): string[] {
  if (!value || value === 'none') return [];
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function uniformBorderStroke(style: PickedComputedStyle): Stroke | null {
  const top = parsePx(style.borderTopWidth) ?? 0;
  const right = parsePx(style.borderRightWidth) ?? 0;
  const bottom = parsePx(style.borderBottomWidth) ?? 0;
  const left = parsePx(style.borderLeftWidth) ?? 0;
  const widths = [top, right, bottom, left];
  const uniform = widths.every((w) => w === top);
  if (!uniform || top === 0) return null;
  const color = parseColor(style.borderTopColor);
  if (!color) return null;
  const styleKey = (style.borderTopStyle || 'solid').toLowerCase();
  const strokeStyle = STROKE_STYLE[styleKey] ?? 'solid';
  return {
    strokeColor: color.hex,
    strokeOpacity: color.opacity,
    strokeStyle,
    strokeWidth: top,
    // CSS borders sit inside the element with `box-sizing: border-box`. The
    // converter emits `border: ...` for both `inner` and `center` alignments
    // — `inner` is the safe default for round-tripping.
    strokeAlignment: 'inner',
  };
}

/**
 * Inspect computed style and box-shadow list, returning Penpot strokes plus the
 * indices of box-shadow entries we consumed (so they don't double up as Shadows).
 *
 * - `border: Npx solid color` (uniform) → stroke `inner`
 * - `box-shadow: 0 0 0 Npx color` (no offset/blur, single entry) → stroke `outer`
 *
 * Per-side borders and `center` alignment aren't recoverable from CSS without
 * extra hints (we'd need a sentinel attribute) — for now we only emit the
 * `inner` form when the border is uniform.
 */
export function strokesFromComputed(style: PickedComputedStyle): StrokeExtraction {
  const strokes: Stroke[] = [];
  const consumed = new Set<number>();

  const inner = uniformBorderStroke(style);
  if (inner) strokes.push(inner);

  const shadows = splitBoxShadowList(style.boxShadow);
  for (let i = 0; i < shadows.length; i++) {
    const entry = shadows[i]!.trim();
    // Pull the color off (it can be at the start OR end depending on browser).
    // Chrome computed style puts it first; authored CSS often puts it last.
    let lengthsPart: string | null = null;
    let colorStr: string | null = null;
    let m = entry.match(/^(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})\s+(.+)$/);
    if (m) {
      colorStr = m[1]!;
      lengthsPart = m[2]!;
    } else {
      m = entry.match(/^(.+?)\s+(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})\s*$/);
      if (m) {
        lengthsPart = m[1]!;
        colorStr = m[2]!;
      }
    }
    if (!colorStr || !lengthsPart) continue;
    const lm = lengthsPart.match(OUTER_STROKE_LENGTHS_RE);
    if (!lm) continue;
    const width = Number(lm[1]);
    const color = parseColor(colorStr);
    if (!color || width <= 0) continue;
    strokes.push({
      strokeColor: color.hex,
      strokeOpacity: color.opacity,
      strokeStyle: 'solid',
      strokeWidth: width,
      strokeAlignment: 'outer',
    });
    consumed.add(i);
  }

  return { strokes, consumedShadowIndices: consumed };
}
