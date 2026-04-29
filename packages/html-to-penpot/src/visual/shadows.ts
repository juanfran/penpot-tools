import type { Shadow } from '@penpot-tools/converter/types';
import { parseColor } from '../build/css';

/**
 * Parse a single `box-shadow` entry into a Penpot Shadow. CSS box-shadow form:
 *
 *   [inset?] <offset-x> <offset-y> [<blur> [<spread>]] [<color>]
 *
 * Chrome's computed style serializes the color at the START (e.g. `rgba(0,0,0,
 * 0.4) 0px 4px 12px 0px`). Authored CSS usually puts it at the END. We accept
 * both — `strokes.ts` does the same for outer-stroke detection. Lengths arrive
 * with a `px` suffix and may be negative (negative `spread` is the common
 * "soft contained shadow" pattern: `0 30px 60px -20px rgba(...)`).
 *
 * Returns null when the entry can't be parsed.
 */
export function parseSingleBoxShadow(entry: string): Shadow | null {
  if (!entry) return null;
  let s = entry.trim();
  let inset = false;
  if (s.startsWith('inset ')) {
    inset = true;
    s = s.slice('inset '.length).trim();
  }

  const COLOR_RE = /(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})/;
  let lengthsPart: string;
  let colorStr: string;
  let m = s.match(new RegExp(`^${COLOR_RE.source}\\s+(.+)$`));
  if (m) {
    colorStr = m[1]!;
    lengthsPart = m[2]!;
  } else {
    m = s.match(new RegExp(`^(.+?)\\s+${COLOR_RE.source}\\s*$`));
    if (!m) return null;
    lengthsPart = m[1]!;
    colorStr = m[2]!;
  }

  const color = parseColor(colorStr);
  if (!color) return null;

  const lengths = lengthsPart.trim().split(/\s+/);
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
