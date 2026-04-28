import type { DimensionsTokenAttrs } from '@penpot-tools/converter/types';

/**
 * CSS property → Penpot `appliedTokens` field mapping.
 *
 * Penpot stores at most one token reference per attribute slot, so when a
 * shorthand resolves to multiple slots (e.g. `padding: var(--space-4)`) we
 * fan out to all of them. The converter's `tokenToCssVarName` replaces dots
 * with dashes — we reverse that here so `--brand-primary` becomes
 * `"brand-primary"` (Penpot doesn't care about dot notation as long as it's
 * consistent).
 */
const PROPERTY_MAP: Record<string, (keyof DimensionsTokenAttrs)[]> = {
  'background-color': ['fill'],
  background: ['fill'],
  color: ['fill'], // resolved to text leaf later
  'border-color': ['strokeColor'],
  'border-top-color': ['strokeColor'],
  'border-radius': ['r1', 'r2', 'r3', 'r4'],
  'border-top-left-radius': ['r1'],
  'border-top-right-radius': ['r2'],
  'border-bottom-right-radius': ['r3'],
  'border-bottom-left-radius': ['r4'],
  'border-width': ['strokeWidth'],
  'border-top-width': ['strokeWidth'],
  width: ['width'],
  height: ['height'],
  'min-width': ['layoutItemMinW'],
  'max-width': ['layoutItemMaxW'],
  'min-height': ['layoutItemMinH'],
  'max-height': ['layoutItemMaxH'],
  gap: ['rowGap', 'columnGap'],
  'row-gap': ['rowGap'],
  'column-gap': ['columnGap'],
  padding: ['p1', 'p2', 'p3', 'p4'],
  'padding-top': ['p1'],
  'padding-right': ['p2'],
  'padding-bottom': ['p3'],
  'padding-left': ['p4'],
  margin: ['m1', 'm2', 'm3', 'm4'],
  'margin-top': ['m1'],
  'margin-right': ['m2'],
  'margin-bottom': ['m3'],
  'margin-left': ['m4'],
  rotate: ['rotation'],
  'font-size': ['fontSize'],
  'font-family': ['fontFamily'],
  'line-height': ['lineHeight'],
  'letter-spacing': ['letterSpacing'],
  'text-transform': ['textCase'],
  'text-decoration': ['textDecoration'],
};

/**
 * Convert a CSS custom property name (`--brand-primary`) into the canonical
 * Penpot token name (`brand-primary`). The converter uses dashes in CSS var
 * names but stores token names with dots — both forms hash to the same record
 * in Penpot's token-set, but for round-tripping we keep the dash form.
 */
function customPropToTokenName(name: string): string {
  return name.replace(/^--/, '');
}

/**
 * Walk an inline style string declaration-by-declaration, returning every
 * `var(--name[, fallback])` reference paired with the property it appears in.
 *
 * Also yields the set of distinct token names (for token-set creation hints).
 */
export function tokensInInlineStyle(inlineStyle: string): {
  appliedTokens: DimensionsTokenAttrs;
  tokenNames: Set<string>;
} {
  const applied: DimensionsTokenAttrs = {};
  const tokenNames = new Set<string>();
  if (!inlineStyle) return { appliedTokens: applied, tokenNames };

  const declarations = inlineStyle.split(';');
  for (const decl of declarations) {
    const colonIdx = decl.indexOf(':');
    if (colonIdx < 0) continue;
    const rawProp = decl.slice(0, colonIdx).trim().toLowerCase();
    const rawValue = decl.slice(colonIdx + 1).trim();
    if (!rawProp || !rawValue) continue;

    // Match the FIRST var() in the value — multiple var() in one declaration is
    // rare in LLM output; we don't try to disambiguate which one applies to
    // which Penpot slot.
    const m = rawValue.match(/var\(\s*(--[a-zA-Z0-9_-]+)/);
    if (!m) continue;
    const tokenName = customPropToTokenName(m[1]!);
    tokenNames.add(tokenName);

    const slots = PROPERTY_MAP[rawProp];
    if (!slots) continue;
    for (const slot of slots) {
      applied[slot] = tokenName as DimensionsTokenAttrs[typeof slot];
    }
  }

  return { appliedTokens: applied, tokenNames };
}
