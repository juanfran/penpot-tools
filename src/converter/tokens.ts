import type { Shape, TextShape } from '../penpot.types';

function getFirstTextLeafFill(shape: TextShape): string | undefined {
  if (!shape.content) return undefined;
  for (const set of shape.content.children) {
    for (const para of set.children) {
      for (const leaf of para.children) {
        if (leaf.fills?.[0]?.fillColor) return leaf.fills[0].fillColor;
      }
    }
  }
  return undefined;
}

/**
 * Scans all page objects for `appliedTokens` and resolves each token name to its CSS color value.
 * Returns a map of `tokenName → cssColorValue`.
 *
 * - `appliedTokens.fill` on a regular shape → resolved from `shape.fills[0].fillColor`
 * - `appliedTokens.fill` on a text shape → resolved from the first text leaf fill color
 * - `appliedTokens.strokeColor` → resolved from `shape.strokes[0].strokeColor`
 */
export function extractTokens(
  objects: Record<string, Shape>,
): Map<string, string> {
  const tokens = new Map<string, string>();

  for (const shape of Object.values(objects)) {
    const applied = shape.appliedTokens;
    if (!applied) continue;

    if (applied.fill) {
      if (!tokens.has(applied.fill)) {
        const color =
          shape.type === 'text'
            ? getFirstTextLeafFill(shape as TextShape)
            : shape.fills?.[0]?.fillColor;
        if (color) tokens.set(applied.fill, color);
      }
    }

    if (applied.strokeColor) {
      if (!tokens.has(applied.strokeColor)) {
        const color = shape.strokes?.[0]?.strokeColor;
        if (color) tokens.set(applied.strokeColor, color);
      }
    }
  }

  return tokens;
}

/**
 * Converts a Penpot token name to a valid CSS custom property name.
 * Dots in token names (e.g. "background.surface.base") are replaced with dashes (e.g. "background-surface-base") because CSS custom properties cannot contain dots.
 * because dots are not valid in CSS custom property names.
 */
export function tokenToCssVarName(tokenName: string): string {
  return tokenName.replace(/\./g, '-');
}

/**
 * Converts a token map to a CSS `:root { ... }` block with custom properties.
 * Returns `''` when the map is empty.
 */
export function tokensToCss(tokens: Map<string, string>): string {
  if (tokens.size === 0) return '';
  const props = Array.from(tokens.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `    --${tokenToCssVarName(name)}: ${value};`)
    .join('\n');
  return `:root {\n${props}\n  }`;
}
