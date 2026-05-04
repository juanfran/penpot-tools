import type {
  FontUsage,
  PageCodeBundle,
  PageHtmlBundle,
  ShapeCodeBundle,
  ShapeHtmlBundle,
} from './convert.ts';

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

/**
 * Static guidance the MCP appends to every shape-code response. The converter
 * mirrors the Penpot tree literally — useful for fidelity, noisy for
 * production code — so the LLM is reminded to flatten / rename / inline
 * before pasting. Keep this block short; it ships on every call.
 */
const CLEANUP_NOTES = `
## Notes
This output mirrors the Penpot design tree literally. Before pasting into a
project the agent should review and **adapt** — common cleanups:
- **Flatten single-child wrappers.** Designs often nest a label inside a
  frame inside the button; collapse them when only one descendant carries
  the actual content (e.g. \`<button><div><p>Submit</p></div></button>\` →
  \`<button>Submit</button>\`).
- **Drop redundant text wrappers.** A \`<p>\` whose only purpose is holding
  the button's label can usually disappear; merge its styles upward.
- **Promote semantic tags.** If a layer is named like a button / link /
  list but no rule was added in the viewer, switch the tag yourself
  (\`<div role="button">\` → \`<button>\`, anchor needs an \`href\`, etc.).
- **Consolidate styles.** Identical class definitions across siblings are
  already deduped; identical *values* across the project (colours, spacing)
  should be lifted to design tokens / Tailwind theme variables.
- **Layer-name fallbacks.** Shapes without a meaningful name produce
  \`s-1\` / \`s-2\` classes — rename those to something the project will
  recognise (or rename the layers in Penpot for next time).
`.trimStart();

export function describeShapeCodeBundle(
  bundle: ShapeCodeBundle,
  opts: DescribeOptions = {},
): string {
  // Pick the right fenced-code language so syntax highlighting works in
  // markdown-aware UIs.
  const codeLang = bundle.format === 'jsx' ? 'jsx' : 'html';
  return (
    `# Shape "${bundle.shapeName}" (${bundle.shapeType}, id ${bundle.shapeId}) — page "${bundle.pageName}"` +
    `\n_format: ${bundle.format} · styling: ${bundle.styling}_` +
    section('tokensCss', 'css', bundle.tokensCss) +
    fontsUsedSection(bundle.fontsUsed) +
    (opts.includeFontsCss ? section('fontsCss', 'css', opts.fontsCss ?? '') : '') +
    section(bundle.format.toUpperCase(), codeLang, bundle.code) +
    (bundle.styling === 'css' ? section('css', 'css', bundle.css) : '') +
    `\n${CLEANUP_NOTES}`
  );
}

export function describePageCodeBundle(
  bundle: PageCodeBundle,
  opts: DescribeOptions = {},
): string {
  const codeLang = bundle.format === 'jsx' ? 'jsx' : 'html';
  return (
    `# Page "${bundle.pageName}"` +
    `\n_format: ${bundle.format} · styling: ${bundle.styling}_` +
    section('tokensCss', 'css', bundle.tokensCss) +
    fontsUsedSection(bundle.fontsUsed) +
    (opts.includeFontsCss ? section('fontsCss', 'css', opts.fontsCss ?? '') : '') +
    section(bundle.format.toUpperCase(), codeLang, bundle.code) +
    (bundle.styling === 'css' ? section('css', 'css', bundle.css) : '') +
    `\n${CLEANUP_NOTES}`
  );
}
