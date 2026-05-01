import type { FontUsage, PageHtmlBundle, ShapeHtmlBundle } from './convert.ts';

/**
 * The "do not paste verbatim, convert to the user's framework" guidance lives
 * in the server-level instructions and the `penpot://convert-guide` resource —
 * we don't repeat it on every call. Each block is omitted when empty so the
 * response stays minimal.
 */
function section(title: string, lang: string, body: string): string {
  if (!body) return '';
  return `\n## ${title}\n\`\`\`${lang}\n${body}\n\`\`\``;
}

/**
 * One-line per font: `Inter — 400, 500, 700i`. Saves ~35 KB per response over
 * inlining the full `@font-face` block (the previous default). Callers that
 * actually need the CSS opt in via `includeFontsCss` and the bundle's
 * `buildFontsCss()` is materialised on demand.
 */
function fontsUsedSection(fonts: readonly FontUsage[]): string {
  if (fonts.length === 0) return '';
  const byFamily = new Map<string, string[]>();
  for (const f of fonts) {
    const variant = `${f.weight}${f.italic ? 'i' : ''}`;
    const arr = byFamily.get(f.family) ?? [];
    arr.push(variant);
    byFamily.set(f.family, arr);
  }
  const lines = [...byFamily]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([family, variants]) => `- ${family} — ${variants.join(', ')}`);
  return `\n## fontsUsed\n${lines.join('\n')}`;
}

export interface DescribeOptions {
  /** Inline the full @font-face CSS block. Defaults to false because it's
   *  ~35 KB of unicode-range payload the LLM rarely needs. */
  includeFontsCss?: boolean;
  /** Pre-computed CSS, when the caller already had to materialise it (e.g. for
   *  rendering a screenshot). Avoids a second fetch. Required if
   *  `includeFontsCss` is true. */
  fontsCss?: string;
}

export function describePageBundle(
  bundle: PageHtmlBundle,
  sourceLabel: string,
  opts: DescribeOptions = {},
): string {
  return (
    `# ${sourceLabel} — page "${bundle.pageName}"` +
    section('tokensCss', 'css', bundle.tokensCss) +
    fontsUsedSection(bundle.fontsUsed) +
    (opts.includeFontsCss ? section('fontsCss', 'css', opts.fontsCss ?? '') : '') +
    section('html', 'html', bundle.html)
  );
}

export function describeShapeBundle(bundle: ShapeHtmlBundle, opts: DescribeOptions = {}): string {
  return describePageBundle(
    bundle,
    `Shape "${bundle.shapeName}" (${bundle.shapeType}, id ${bundle.shapeId})`,
    opts,
  );
}
