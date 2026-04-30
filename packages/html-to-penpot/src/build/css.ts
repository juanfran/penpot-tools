/**
 * Tiny parsers for the CSS substrings the builder consumes. Computed style
 * values come back from the browser already resolved (e.g. `rgb(...)` not
 * named colors), so we only need to handle the canonical forms.
 */

import type { HexColor } from '@penpot-tools/converter/types';

const NUM = /-?\d+(?:\.\d+)?/.source;

/** Parse a px value (e.g. "12px", "0px") into a number. Returns null otherwise. */
export function parsePx(value: string): number | null {
  if (!value) return null;
  const m = value.match(new RegExp(`^(${NUM})px$`));
  return m ? Number(m[1]) : null;
}

/**
 * Parse a CSS length that may be either a px value (e.g. "12px") or a
 * percentage of a base dimension (e.g. "50%" → `base * 0.5`).
 *
 * Browsers preserve `%` in the computed value of properties like
 * `border-radius`, so the builder has to resolve them itself using the
 * element's measured size. Returns `null` when the value is neither px nor %.
 *
 * For multi-value computed strings ("23px 25px" — elliptic per-corner radius)
 * only the FIRST value is parsed: Penpot stores a single scalar radius per
 * corner, so we approximate the ellipse with its horizontal radius. Callers
 * that need both axes should split on whitespace upstream.
 */
export function parseLengthOrPct(value: string, base: number): number | null {
  if (!value) return null;
  const first = value.trim().split(/\s+/)[0] ?? '';
  const px = first.match(new RegExp(`^(${NUM})px$`));
  if (px) return Number(px[1]);
  const pct = first.match(new RegExp(`^(${NUM})%$`));
  if (pct) return (Number(pct[1]) / 100) * base;
  return null;
}

/** Parse a unitless number (e.g. "1", "0.5"). */
export function parseNumber(value: string): number | null {
  if (!value) return null;
  const m = value.match(new RegExp(`^(${NUM})$`));
  return m ? Number(m[1]) : null;
}

/**
 * Pull a single CSS declaration's px value from an inline `style` attribute
 * string, e.g. `extractInlinePx('width:1px;height:36px', 'width') === 1`.
 *
 * Used to recover authorial intent when flex layout has shrunk a thin element
 * below its specified size. Returns `null` if the property isn't present, isn't
 * a px value, or appears inside a `var(...)` reference.
 */
export function extractInlinePx(inlineStyle: string, prop: string): number | null {
  if (!inlineStyle) return null;
  const escaped = prop.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const re = new RegExp(`(?:^|;)\\s*${escaped}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)px\\b`, 'i');
  const m = inlineStyle.match(re);
  return m ? Number(m[1]) : null;
}

export interface ParsedColor {
  hex: HexColor;
  opacity: number;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function toHexComponent(n: number): string {
  return clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
}

/**
 * Parse a CSS color string from a computed style. Browsers always serialize
 * to `rgb(r, g, b)` / `rgba(r, g, b, a)` (modern Chromium also emits
 * `rgb(r g b / a)`), plus `transparent` → `rgba(0, 0, 0, 0)`.
 */
export function parseColor(value: string): ParsedColor | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'transparent') return null;

  // rgb(r, g, b) | rgba(r, g, b, a) — comma separated
  let m = trimmed.match(
    new RegExp(`^rgba?\\(\\s*(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})\\s*(?:,\\s*(${NUM})\\s*)?\\)$`),
  );
  // rgb(r g b) | rgb(r g b / a) — space separated
  if (!m) {
    m = trimmed.match(
      new RegExp(
        `^rgba?\\(\\s*(${NUM})\\s+(${NUM})\\s+(${NUM})(?:\\s*\\/\\s*(${NUM})%?)?\\s*\\)$`,
      ),
    );
  }
  if (!m) return null;

  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const a = m[4] !== undefined ? Number(m[4]) : 1;

  if (a === 0) return { hex: '#000000' as HexColor, opacity: 0 };

  const hex = ('#' + toHexComponent(r) + toHexComponent(g) + toHexComponent(b)).toUpperCase() as HexColor;
  return { hex, opacity: a };
}
