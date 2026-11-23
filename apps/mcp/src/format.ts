import type {
  FontUsage,
  PageCodeBundle,
  PageHtmlBundle,
  ShapeCodeBundle,
  ShapeHtmlBundle,
} from './convert.ts';
import type { DesignCommentThread } from './comments.ts';

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
  /** Pre-rendered `commentsSection(...)` block, placed right under the title. */
  comments?: string;
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
    (opts.comments ?? '') +
    section('tokensCss', 'css', bundle.tokensCss) +
    fontsUsedSection(bundle.fontsUsed) +
    (opts.includeFontsCss ? section('fontsCss', 'css', opts.fontsCss ?? '') : '') +
    section(bundle.format.toUpperCase(), codeLang, bundle.code) +
    (bundle.styling === 'css' ? section('css', 'css', bundle.css) : '') +
    `\n${CLEANUP_NOTES}`
  );
}

export function describePageCodeBundle(bundle: PageCodeBundle, opts: DescribeOptions = {}): string {
  const codeLang = bundle.format === 'jsx' ? 'jsx' : 'html';
  return (
    `# Page "${bundle.pageName}"` +
    `\n_format: ${bundle.format} · styling: ${bundle.styling}_` +
    (opts.comments ?? '') +
    section('tokensCss', 'css', bundle.tokensCss) +
    fontsUsedSection(bundle.fontsUsed) +
    (opts.includeFontsCss ? section('fontsCss', 'css', opts.fontsCss ?? '') : '') +
    section(bundle.format.toUpperCase(), codeLang, bundle.code) +
    (bundle.styling === 'css' ? section('css', 'css', bundle.css) : '') +
    `\n${CLEANUP_NOTES}`
  );
}

export interface CommentsSectionOptions {
  /** Shape id → class in the generated code (css styling). */
  classByShapeId?: Record<string, string>;
  /** Set when loading comments failed — rendered instead of the thread list. */
  error?: string;
  /** What the threads were scoped to, for the empty-state line. */
  scopeLabel?: string;
}

const COMMENTS_PREAMBLE =
  'Notes the team pinned on this design. They often carry implementation requirements the layers ' +
  "can't express (behaviour, states, validation, copy, responsive rules, open decisions). Apply " +
  'them while implementing. Resolved threads are included — they may still record decisions that hold.';

function indentContinuation(text: string, indent: string): string {
  return text.replace(/\n/g, `\n${indent}`);
}

function describeAnchor(
  thread: DesignCommentThread,
  classByShapeId: Record<string, string>,
): string {
  const a = thread.anchor;
  if (a.kind === 'canvas' || !a.shapeId) {
    const at = `(at ${thread.position.x}, ${thread.position.y})`;
    if (!a.nearBoards?.length) return `on the canvas, not over any layer ${at}`;
    const near = a.nearBoards.map((b) => `"${b.name}" (${b.distance}px away, id ${b.id})`);
    return `on the canvas next to board ${near.join(' / ')} ${at}`;
  }
  const cls = classByShapeId[a.shapeId];
  const target = cls ? `\`.${cls}\`` : `"${a.shapeName}" (${a.shapeType})`;
  const text = a.text ? ` · text "${a.text}"` : '';
  return `on ${target} — ${a.path}${text} · id ${a.shapeId}`;
}

/**
 * `## Design comments` block appended to `get_html` / returned by
 * `get_comments`. Always emitted (even when empty) so the agent knows the
 * comments were checked rather than missing.
 */
export function commentsSection(
  threads: readonly DesignCommentThread[],
  opts: CommentsSectionOptions = {},
): string {
  if (opts.error) {
    return `\n## Design comments\n_Could not load design comments: ${opts.error}_`;
  }
  if (threads.length === 0) {
    return `\n## Design comments\n_No design comments on ${opts.scopeLabel ?? 'this design'}._`;
  }
  const open = threads.filter((t) => !t.resolved).length;
  const resolved = threads.length - open;
  const counts = [`${open} open`, resolved ? `${resolved} resolved` : '']
    .filter(Boolean)
    .join(', ');
  const classByShapeId = opts.classByShapeId ?? {};
  const items = threads.map((t) => {
    const header = `- #${t.seqn} · ${t.resolved ? 'resolved' : 'open'} · ${describeAnchor(t, classByShapeId)}`;
    const lines = t.comments.map(
      (c) =>
        `  - **${c.author}** (${c.createdAt.slice(0, 10)}): ${indentContinuation(c.text, '    ')}`,
    );
    const missing = t.commentCount - t.comments.length;
    if (missing > 0) lines.push(`  - _…${missing} more repl${missing === 1 ? 'y' : 'ies'}_`);
    return [header, ...lines].join('\n');
  });
  return `\n## Design comments (${counts})\n${COMMENTS_PREAMBLE}\n\n${items.join('\n')}`;
}
