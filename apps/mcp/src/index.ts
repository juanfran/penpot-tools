import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  convertPageToCode,
  convertPageToHtml,
  convertShapeToCode,
  convertShapeToHtml,
  getPageOverview,
  getPageTokens,
} from './convert.ts';
import { describePageCodeBundle, describeShapeCodeBundle } from './format.ts';
import { fetchPage } from './penpot-api.ts';
import { buildScreenshotContent, renderScreenshot, type ScreenshotOutput } from './screenshot.ts';
import { requireSelection, requireToken, resolvePage, resolveTarget } from './state.ts';
import { registerGuideResources } from './resources.ts';
import { registerAssetTools } from './tools/assets.ts';
import { registerApplyTokenTool } from './tools/write/apply-token.ts';
import { registerCreateFromHtmlTool } from './tools/write/create-from-html.ts';
import { registerCreateTokenSetTool } from './tools/write/create-token-set.ts';
import { registerModifyShapeTool } from './tools/write/modify-shape.ts';
import { registerUpdateSelectionFromHtmlTool } from './tools/write/update-selection.ts';
import { registerUploadMediaTool } from './tools/write/upload-media.ts';

type Mode = 'read-only' | 'read-write';

function resolveMode(): Mode {
  const raw = process.env['PENPOT_MCP_MODE']?.trim().toLowerCase();
  if (!raw || raw === 'read-write') return 'read-write';
  if (raw === 'read-only') return 'read-only';
  throw new Error(
    `Invalid PENPOT_MCP_MODE="${process.env['PENPOT_MCP_MODE']}". Expected "read-only" or "read-write".`,
  );
}

const MODE: Mode = resolveMode();
const WRITABLE = MODE === 'read-write';

const READ_ONLY_INSTRUCTIONS = `
Tools to READ the Penpot file the user has open in the dev-mode viewer
(http://localhost:3000). This server is running in READ-ONLY mode — there are
NO write tools registered, so do not offer to modify the design. The current
file/page/shape selection is tracked by the viewer — call
\`get_current_selection\` if unsure; do NOT ask the user for IDs.

Read tools: \`get_html\` (clean HTML/JSX with extracted CSS classes or
Tailwind utilities + optional inline screenshot), \`get_page_overview\`
(boards/fonts/top tokens), \`get_page_tokens\` (full tokens + \`:root\`
CSS), \`get_screenshot\` (image only), \`list_assets\` / \`download_asset\`
(image media). \`get_html\` defaults to \`format:'html'\` +
\`styling:'css'\` (class names slugified from layer names — "Icons /
token" → \`.icons-token\`, \`data-*\` stripped). Pass \`format:'jsx'\` or
\`styling:'tailwind'\` when the project needs them. Both shape and page
modes share the same pipeline. The output mirrors the Penpot design
tree literally; the response's \`## Notes\` section lists the cleanups
the agent should apply before pasting (flatten single-child wrappers,
promote semantic tags, drop redundant text wrappers, …). The CSS
properties the converter ever emits are listed at
\`penpot://supported-css\` — useful when round-tripping designs with the
write tools (only that subset survives \`create_design_from_html\`).
When implementing or reworking a design call
\`get_html({ includeScreenshot: true })\` so code + image arrive in one
round trip.

\`get_html\` covers every shape/page case: no args → viewer selection
(selected shape, else page); \`shapeId\` → that shape; \`fileId\`/\`pageId\`
→ that page (works without the viewer open). Use \`get_page_overview\` to
discover board ids by name, then \`get_html({ shapeId, fileId, pageId })\`
to fetch each. Per-file semantic-tag rules set in the viewer ("this shape
is a button", "any layer named *link* is an \`<a>\`") are honoured
automatically. \`PENPOT_TOKEN\` env var skips the viewer entirely.

For framework conversion guidance fetch \`penpot://convert-guide\`.
`.trim();

const READ_WRITE_INSTRUCTIONS = `
Tools to read and write the Penpot file the user has open in the dev-mode viewer
(http://localhost:3000). The current file/page/shape selection is tracked by the
viewer — call \`get_current_selection\` if unsure; do NOT ask the user for IDs.

Read tools: \`get_html\` (clean HTML/JSX with extracted CSS classes or
Tailwind utilities + optional inline screenshot), \`get_page_overview\`
(boards/fonts/top tokens), \`get_page_tokens\` (full tokens + \`:root\`
CSS), \`get_screenshot\` (image only), \`list_assets\` / \`download_asset\`
(image media). \`get_html\` defaults to \`format:'html'\` +
\`styling:'css'\` (class names slugified from layer names — "Icons /
token" → \`.icons-token\`, \`data-*\` stripped). Pass \`format:'jsx'\` or
\`styling:'tailwind'\` when the project needs them. Both shape and page
modes share the same pipeline. The output mirrors the Penpot design
tree literally; the response's \`## Notes\` section lists the cleanups
the agent should apply before pasting (flatten single-child wrappers,
promote semantic tags, drop redundant text wrappers, …). The CSS
properties the converter ever emits are listed at
\`penpot://supported-css\` — useful when round-tripping designs with the
write tools (only that subset survives \`create_design_from_html\`).
When implementing or reworking a design call
\`get_html({ includeScreenshot: true })\` so code + image arrive in one
round trip.

\`get_html\` covers every shape/page case: no args → viewer selection
(selected shape, else page); \`shapeId\` → that shape; \`fileId\`/\`pageId\`
→ that page (works without the viewer open). Use \`get_page_overview\` to
discover board ids by name, then \`get_html({ shapeId, fileId, pageId })\`
to fetch each. Per-file semantic-tag rules set in the viewer ("this shape
is a button", "any layer named *link* is an \`<a>\`") are honoured
automatically. \`PENPOT_TOKEN\` env var skips the viewer entirely.

Write tools (\`create_design_from_html\`, \`update_selection_from_html\`,
\`modify_shape\`, \`apply_token\`, \`create_token_set\`, \`upload_media\`) push
changes via Penpot's REST API. The user must refresh the viewer to see results.
HTML is rendered in headless Chromium; only a CSS subset is honoured (below).

# Write-mode CSS rules (condensed — full reference at \`penpot://write-guide\`)

Send a fragment (\`<!DOCTYPE>\`/\`<html>\`/\`<body>\` are auto-stripped). Set
\`data-name="..."\` on EVERY element — without it layers are named after the
tag. Every dropped CSS declaration is reported under \`## Warnings\` in the
response — always scan it before declaring done. Pass
\`includeScreenshot:true\` on the create/update tools to get a PNG of the
result back in the same call (saves the follow-up \`get_screenshot\`).

**Author ONE outer wrapper.** When your HTML has a single top-level element,
THAT element becomes the Penpot board — its background / radius / padding /
shadow / dimensions land directly on the board's chrome (no synthetic frame
in between). So for a card design, write \`<div data-name="Card" style="...">
…children…</div>\` and your card chrome survives. The board's layer name is
the MCP \`name\` param if provided, else the wrapper's \`data-name\`. Sibling
top-level elements still get a synthetic wrapper, so prefer one-root.

Composition: \`display:flex\` / \`display:grid\` for stacked layout;
\`position:relative\` parent + \`position:absolute; left/top/right/bottom\`
children for editorial overlap. **Z-order = DOM order** — later siblings
paint on top. \`transform: rotate(<deg>)\` rotates around the centre and
snaps to integer degrees within rounding noise.

For tiny edits prefer \`modify_shape\`:
- \`ops.text\`: replace a label without rewriting HTML — preserves font, size,
  colour, alignment. Multi-line input ('\\n') becomes paragraphs.
- \`ops.fill\` / \`ops.stroke\` / \`ops.radius\` / \`ops.opacity\` / \`ops.name\`
  for surgical visual tweaks. Reach for \`update_selection_from_html\` only
  when the structure actually changes.

\`update_selection_from_html\` preserves the deleted shape's sibling index,
so paint order stays stable when you replace a child of a card.

✓ Supported: width/height/padding (per-side); border-radius (px or %, %
resolves against min(w,h)); border (uniform — top side wins); opacity, color
(rgb/rgba/#hex); background (solid / linear-gradient / radial-gradient,
alpha in stops works); box-shadow (drop, inset, negative spread, multi;
\`0 0 0 Npx color\` → outer stroke); **\`font-family\` for any Google Fonts
family is auto-loaded before measurement** (no \`<link>\` needed — just
declare it: \`font-family: 'Inter'\`); font size/weight/style/line-height;
letter-spacing, text-align, **text-transform (uppercase / lowercase /
capitalize is pre-applied to the stored glyphs)**, \`white-space: nowrap\`
to keep text single-line in a tight flex row; display:flex/grid (gap,
padding, justify/align, grid-template px/fr/auto/repeat); **\`<br>\` for
hard line breaks inside a single text shape** (one paragraph per line);
\`var(--name, fallback)\` tokens — fallback REQUIRED (used to compute
geometry).

✗ Dropped (warned): margin (use flex \`gap\` or padding); conic-gradient,
image \`url()\`, multiple backgrounds; scale/skew/matrix/3D transforms,
transform-origin; position:fixed/sticky; filter; mix-blend-mode; clip-path;
mask; outline; \`::before\`/\`::after\`; transitions, animations;
currentColor; text-decoration colour.

Auto-splits & gotchas:
- A single text-only element (\`<div data-name="X">label</div>\`) becomes
  ONE Penpot text shape — no wrapper frame. Set the element's font / colour
  on the wrapper and you're done. Use this for label-only \`update_selection_from_html\`
  payloads.
- A leaf with text PLUS box visuals (background/border/shadow) is auto-split
  into a frame + child text shape — use this single-element pattern for chips,
  pills, buttons, avatars, badges, circular icon buttons. Text auto-centres
  when the parent uses flex centring (\`align-items:center;
  justify-content:center\`).
- Padding is invisible without background/border/shadow. For invisible
  spacing use flex \`gap\`.
- Mixed text + element children drops bare text:
  \`<p>Hello <span>x</span></p>\` loses "Hello". Wrap every text run in its
  own element (e.g. \`<span>Hello</span> <span>x</span>\`). \`<br>\` is the
  exception — it's collapsed into a line break in the same text shape.
- Source whitespace inside text leaves is collapsed like the browser does
  (runs of whitespace → single space, leading/trailing trimmed).
- Padding on a \`position:relative\` wrapper does NOT inset its absolutely-
  positioned children (HTML spec). Use child coordinates that already include
  the padding — or wrap the children in a relative inner div.
- Silent occlusion: a small layer fully covered by a later opaque sibling
  becomes invisible. Reorder DOM so the small layer paints AFTER the
  occluder, or shift the occluder.
- Tight flex rows: when a text leaf in \`display:flex\` wraps to a second
  line because siblings + gaps + padding don't leave enough room, the tool
  warns naming both the text and the row. Fix by widening, shrinking
  gap/padding, or adding \`white-space:nowrap\` to the text.

For framework conversion guidance (read-mode) fetch \`penpot://convert-guide\`.
For the full write-mode reference (recipes with code, tokens DTCG schema,
concurrency, per-attribute matrix) fetch \`penpot://write-guide\`.
`.trim();

const SERVER_INSTRUCTIONS = WRITABLE ? READ_WRITE_INSTRUCTIONS : READ_ONLY_INSTRUCTIONS;

const server = new McpServer(
  { name: 'penpot-viewer', version: '0.1.0' },
  { instructions: SERVER_INSTRUCTIONS },
);

const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });

const okImage = (img: ScreenshotOutput, caption: string) => ({
  content: buildScreenshotContent(img, caption),
});

server.registerTool(
  'get_current_selection',
  {
    title: 'Current viewer selection',
    description: 'Returns {fileId, pageId, shapeId?, teamId} for the open viewer.',
    inputSchema: {},
  },
  async () => {
    const sel = await requireSelection();
    return ok(JSON.stringify(sel, null, 2));
  },
);

server.registerTool(
  'get_html',
  {
    title: 'HTML / JSX for a Penpot shape (or full page)',
    description:
      'Returns clean, framework-ready code for a shape OR a full page: HTML or JSX with class / className refs (no inline styles), plus the matching CSS classes (or Tailwind utilities baked into the markup). Class names are derived from each layer\'s name ("Icons / token" → .icons-token); `<p>`/`<span>` text leaves inherit a `${parent}-text` class. `data-*` attributes are stripped by default. Per-file semantic rules — set in the viewer — are honoured automatically: shapes named "button", `<a>`-tagged ids, `name-contains` patterns, etc. lift the wrapper out of the default `<div>`. The output mirrors the Penpot tree literally: deep wrappers (`<div><div><p>X</p></div></div>`) are common — review the `## Notes` section and flatten / drop redundant wrappers before pasting into a project. With no args, uses the viewer selection (selected shape, else the page). For the exact CSS subset the converter ever emits — useful when feeding the write tools (`create_design_from_html`) — fetch `penpot://supported-css`. Set includeScreenshot:true to also receive a PNG render in the same response. See `penpot://convert-guide` before adapting into framework code.',
    inputSchema: {
      fileId: z
        .string()
        .uuid()
        .optional()
        .describe("Override the file id; defaults to the viewer's current selection."),
      pageId: z
        .string()
        .uuid()
        .optional()
        .describe("Override the page id; defaults to the viewer's current selection."),
      shapeId: z
        .string()
        .optional()
        .describe(
          'Fetch this shape instead of the full page. Without fileId/pageId falls back to the viewer selection.',
        ),
      format: z
        .enum(['html', 'jsx'])
        .optional()
        .describe('Output language for the markup. Default `html`.'),
      styling: z
        .enum(['css', 'tailwind'])
        .optional()
        .describe(
          '`css` extracts inline styles into named classes (returned alongside the markup). `tailwind` inlines Tailwind v4 utility classes. Default `css`.',
        ),
      includeDataAttrs: z
        .boolean()
        .optional()
        .describe(
          'Keep the converter\'s `data-id` / `data-type` / `data-name` / `data-penpot-*` on the output. Default false — those attrs are useful for the inspector but pure noise once you paste the code into a project.',
        ),
      includeScreenshot: z
        .boolean()
        .optional()
        .describe('Also return a PNG render in the same response. Default false.'),
      includeFontsCss: z
        .boolean()
        .optional()
        .describe(
          'Inline the full @font-face CSS block (~35 KB per response). Default false — the response always lists the families/weights used under `## fontsUsed`. Only opt in if you need the raw CSS for a downstream tool.',
        ),
      maxWidth: z
        .number()
        .int()
        .positive()
        .max(4000)
        .optional()
        .describe('Screenshot max width when includeScreenshot:true.'),
      maxHeight: z
        .number()
        .int()
        .positive()
        .max(10000)
        .optional()
        .describe('Screenshot max height when includeScreenshot:true.'),
    },
  },
  async ({
    fileId,
    pageId,
    shapeId,
    format,
    styling,
    includeDataAttrs,
    includeScreenshot,
    includeFontsCss,
    maxWidth,
    maxHeight,
  }) => {
    const token = await requireToken();
    const target = await resolveTarget({ fileId, pageId, shapeId });

    if (target.shapeId) {
      const bundle = await convertShapeToCode(
        token,
        target.fileId,
        target.pageId,
        target.shapeId,
        { format, styling, includeDataAttrs },
      );
      const needFontsCss = !!includeFontsCss || !!includeScreenshot;
      const fontsCss = needFontsCss ? await bundle.buildFontsCss() : '';
      const text = describeShapeCodeBundle(bundle, { includeFontsCss, fontsCss });
      const content: Array<
        | { type: 'text'; text: string }
        | { type: 'image'; data: string; mimeType: string }
      > = [{ type: 'text', text }];

      if (includeScreenshot) {
        // Render the original (still-styled) HTML so the screenshot reflects
        // the design exactly — the cleaned `code` has had its inline styles
        // moved into class definitions and would render unstyled in headless.
        const previewBundle = await convertShapeToHtml(
          token,
          target.fileId,
          target.pageId,
          target.shapeId,
        );
        const shot = await renderScreenshot({
          html: previewBundle.html,
          tokensCss: previewBundle.tokensCss,
          fontsCss: fontsCss || (await previewBundle.buildFontsCss()),
          maxWidth,
          maxHeight,
        });
        const caption = `Penpot screenshot — shape ${target.shapeId} on page "${bundle.pageName}"`;
        content.push(...buildScreenshotContent(shot, caption));
      }

      return { content };
    }

    // Page mode: same pipeline as shape mode applied across every top-level
    // board, with shared class state so identical declarations across boards
    // collapse to a single rule.
    const bundle = await convertPageToCode(token, target.fileId, target.pageId, {
      format,
      styling,
      includeDataAttrs,
    });
    const needFontsCss = !!includeFontsCss || !!includeScreenshot;
    const fontsCss = needFontsCss ? await bundle.buildFontsCss() : '';
    const text = describePageCodeBundle(bundle, { includeFontsCss, fontsCss });
    const content: Array<
      | { type: 'text'; text: string }
      | { type: 'image'; data: string; mimeType: string }
    > = [{ type: 'text', text }];
    if (includeScreenshot) {
      // Screenshot renders the still-styled HTML so the visual is exact —
      // the cleaned `code` has had its inline styles moved into class
      // definitions and would render unstyled in headless.
      const previewBundle = await convertPageToHtml(
        token,
        target.fileId,
        target.pageId,
      );
      const shot = await renderScreenshot({
        html: previewBundle.html,
        tokensCss: previewBundle.tokensCss,
        fontsCss: fontsCss || (await previewBundle.buildFontsCss()),
        maxWidth,
        maxHeight,
      });
      const caption = `Penpot screenshot — full page "${bundle.pageName}"`;
      content.push(...buildScreenshotContent(shot, caption));
    }
    return { content };
  },
);

server.registerTool(
  'get_page',
  {
    title: 'Raw Penpot page data',
    description:
      "Returns the raw Penpot page JSON exactly as the API delivers it (id, name, options, and the full `objects` map keyed by shape id). Use when you need the underlying data structure — token usages, layout flags, content trees — rather than HTML. Defaults to the viewer selection; pass fileId/pageId to bypass the viewer. Output can be large (every shape on the page); prefer `get_page_overview` or `get_html` when you don't need the raw shape JSON.",
    inputSchema: {
      fileId: z
        .string()
        .uuid()
        .optional()
        .describe("Override the file id; defaults to the viewer's current selection."),
      pageId: z
        .string()
        .uuid()
        .optional()
        .describe("Override the page id; defaults to the viewer's current selection."),
    },
  },
  async ({ fileId, pageId }) => {
    const token = await requireToken();
    const page = await resolvePage(fileId, pageId);
    const data = await fetchPage(token, page.fileId, page.pageId);
    return ok(JSON.stringify(data, null, 2));
  },
);

server.registerTool(
  'get_page_tokens',
  {
    title: 'Design tokens applied on the current page',
    description:
      'Tokens (colors, typography, spacing, radius, ...) plus a ready-to-paste :root { ... } block.',
    inputSchema: {
      fileId: z.string().uuid().optional(),
      pageId: z.string().uuid().optional(),
    },
  },
  async ({ fileId, pageId }) => {
    const token = await requireToken();
    const page = await resolvePage(fileId, pageId);
    const bundle = await getPageTokens(token, page.fileId, page.pageId);
    const text = [
      `# Tokens — page "${bundle.pageName}"`,
      bundle.css ? '\n## CSS\n```css\n' + bundle.css + '\n```' : '',
      '\n## Usages\n```json\n' + JSON.stringify(bundle.tokens) + '\n```',
    ]
      .filter(Boolean)
      .join('\n');
    return ok(text);
  },
);

server.registerTool(
  'get_page_overview',
  {
    title: 'Structural overview of the current page',
    description:
      'Page name, board count, fonts, and top tokens. Defaults to top-level boards only — pass depth>1 to recurse, or summary=true to skip the tree entirely.',
    inputSchema: {
      fileId: z.string().uuid().optional(),
      pageId: z.string().uuid().optional(),
      depth: z
        .number()
        .int()
        .min(0)
        .max(6)
        .optional()
        .describe('Tree depth (default 1: top-level boards only).'),
      summary: z
        .boolean()
        .optional()
        .describe('Skip the boards tree entirely. Cheapest response.'),
    },
  },
  async ({ fileId, pageId, depth, summary }) => {
    const token = await requireToken();
    const page = await resolvePage(fileId, pageId);
    const overview = await getPageOverview(token, page.fileId, page.pageId, {
      depth,
      summary,
    });
    const lines = [
      `# Page "${overview.pageName}"`,
      `- shapes: ${overview.totalShapes}, boards: ${overview.topLevelBoards.length}`,
      `- fonts: ${overview.fontsUsed.join(', ') || '(none)'}`,
    ];
    if (!summary) {
      lines.push('', '## Boards', '```json', JSON.stringify(overview.topLevelBoards), '```');
    }
    if (overview.tokenSummary.length > 0) {
      lines.push('', '## Top tokens', '```json', JSON.stringify(overview.tokenSummary), '```');
    }
    return ok(lines.join('\n'));
  },
);

server.registerTool(
  'get_screenshot',
  {
    title: 'PNG of the current selection',
    description:
      'Selected shape if any, else the full page. Defaults to a 1600×2000 cap; output is auto-trimmed and the caption flags it. Raise maxWidth/maxHeight only when needed. Pass fileId/pageId to bypass the viewer selection (e.g. when the viewer is not open).',
    inputSchema: {
      target: z
        .enum(['auto', 'page', 'shape'])
        .optional()
        .describe('auto (default) | page | shape.'),
      shapeId: z.string().optional(),
      fileId: z
        .string()
        .uuid()
        .optional()
        .describe("Override the file id; defaults to the viewer's current selection."),
      pageId: z
        .string()
        .uuid()
        .optional()
        .describe("Override the page id; defaults to the viewer's current selection."),
      maxWidth: z.number().int().positive().max(4000).optional(),
      maxHeight: z.number().int().positive().max(10000).optional(),
    },
  },
  async ({ target = 'auto', shapeId, fileId, pageId, maxWidth, maxHeight }) => {
    const token = await requireToken();
    const resolved = await resolveTarget({ fileId, pageId, shapeId });
    const resolvedShape = target === 'page' ? undefined : resolved.shapeId;

    const wantShape = target === 'shape' || (target === 'auto' && !!resolvedShape);
    if (target === 'shape' && !resolvedShape) {
      throw new Error(
        'target="shape" requires a shapeId, either passed in or selected in the viewer.',
      );
    }

    const bundle =
      wantShape && resolvedShape
        ? await convertShapeToHtml(token, resolved.fileId, resolved.pageId, resolvedShape)
        : await convertPageToHtml(token, resolved.fileId, resolved.pageId);

    const fontsCss = await bundle.buildFontsCss();
    const shot = await renderScreenshot({
      html: bundle.html,
      tokensCss: bundle.tokensCss,
      fontsCss,
      maxWidth,
      maxHeight,
    });

    const caption =
      wantShape && resolvedShape
        ? `Penpot screenshot — shape ${resolvedShape} on page "${bundle.pageName}"`
        : `Penpot screenshot — full page "${bundle.pageName}"`;

    return okImage(shot, caption);
  },
);

registerAssetTools(server);

registerGuideResources(server, { writable: WRITABLE });

if (WRITABLE) {
  registerApplyTokenTool(server);
  registerCreateFromHtmlTool(server);
  registerCreateTokenSetTool(server);
  registerModifyShapeTool(server);
  registerUpdateSelectionFromHtmlTool(server);
  registerUploadMediaTool(server);
}

const transport = new StdioServerTransport();
await server.connect(transport);
