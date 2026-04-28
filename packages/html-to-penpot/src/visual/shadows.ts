import type { Shadow } from '@penpot-tools/converter/types';
import { parseColor } from '../build/css';

/**
 * Parse a single `box-shadow` entry into a Penpot Shadow. CSS box-shadow form:
 *
 *   [inset?] <offset-x> <offset-y> [<blur> [<spread>]] [<color>]
 *
 * Browsers normalize the order so the color always sits at the END (for
 * computed style) regardless of where the author wrote it. We also see lengths
 * arrive as `12px`, never bare numbers.
 *
 * Returns null when the entry cannot be parsed (or it's the 0/0/0/spread form
 * which `strokes.ts` already consumed as an outer stroke).
 */
export function parseSingleBoxShadow(entry: string): Shadow | null {
  if (!entry) return null;
  let s = entry.trim();
  let inset = false;
  if (s.startsWith('inset ')) {
    inset = true;
    s = s.slice('inset '.length).trim();
  }

  // Pull the color off the end. We expect a single color token — either rgb/rgba(...) or
  // a hex / named color. Browsers always serialize as rgb/rgba, but be defensive.
  const colorMatch = s.match(/(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})\s*$/);
  if (!colorMatch) return null;
  const colorStr = colorMatch[0];
  const color = parseColor(colorStr);
  if (!color) return null;

  const lengths = s.slice(0, s.length - colorStr.length).trim().split(/\s+/);
  if (lengths.length < 2) return null;

  const px = (v: string | undefined): number | null => {
    if (!v) return null;
    const m = v.match(/^(-?\d+(?:\.\d+)?)px$/);
    return m ? Number(m[1]) : null;
  };

  const offsetX = px(lengths[0]);
  const offsetY = px(lengths[1]);
  const blur = px(lengths[2]) ?? 0;
  const spread = px(lengths[3]) ?? 0;
  if (offsetX === null || offsetY === null) return null;

  return {
    id: null,
    style: inset ? 'inner-shadow' : 'drop-shadow',
    offsetX,
    offsetY,
    blur,
    spread,
    hidden: false,
    color: { color: color.hex, opacity: color.opacity },
  };
}

/**
 * Build the Penpot Shadow array from a CSS box-shadow string, skipping entries
 * already consumed as outer strokes (`0 0 0 Npx color`).
 */
export function shadowsFromBoxShadowList(
  entries: string[],
  consumedIndices: Set<number>,
): Shadow[] {
  const out: Shadow[] = [];
  for (let i = 0; i < entries.length; i++) {
    if (consumedIndices.has(i)) continue;
    const shadow = parseSingleBoxShadow(entries[i]!);
    if (shadow) out.push(shadow);
  }
  return out;
}
