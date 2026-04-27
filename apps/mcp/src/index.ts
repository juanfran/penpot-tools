import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  convertPageToHtml,
  convertShapeToHtml,
  getPageOverview,
  getPageTokens,
} from './convert.ts';
import { describePageBundle, describeShapeBundle } from './format.ts';
import { renderScreenshot } from './screenshot.ts';
import { requireSelection, requireToken } from './state.ts';

const SERVER_INSTRUCTIONS = `
This MCP exposes the design the user currently has open in the Penpot dev-mode viewer
(running locally at http://localhost:3000). The "current selection" — file, page, and
optional shape — is tracked by the viewer and read here. There is no need to ask the
user for IDs; they pick them by navigating the viewer UI.

When you call any of the html-returning tools you receive raw HTML produced by the
penpot-random converter. That HTML is intentionally low-level:

  * It is a tree of <div> elements with **inline style="..."** attributes.
  * It carries data-id / data-type / data-name attributes from Penpot — keep them when
    useful for traceability, drop them in production output.
  * It uses CSS custom properties (var(--token-name, fallback)) for design tokens.
    The matching :root { ... } block is returned in the "tokensCss" field.
  * It references web fonts via @font-face declarations returned in "fontsCss".

Your job is to turn that raw output into something the user can use. Do NOT just
paste it verbatim. Always:

  1. Identify the user's target framework / styling (look at the surrounding code
     they showed you, the file extension, package.json, or ask them):
       - .tsx / React  -> emit JSX with className
       - .vue          -> emit <template> using class=
       - .html / .astro / .njk / Liquid / etc. -> emit semantic HTML
       - Tailwind project (tailwind.config, "@tailwindcss" import) -> use Tailwind
         utility classes; only fall back to inline style when no utility exists
         (custom transforms, exact pixel offsets the design depends on, etc.)
       - Plain CSS project -> emit class names + a separate stylesheet
       - shadcn / ui kit -> map common patterns (button, input, card) to the kit's
         components when the visual matches

  2. Replace the generic <div> tree with **semantic HTML**:
       - <header>, <nav>, <main>, <section>, <article>, <aside>, <footer>
       - <h1>..<h6> for heading-looking text shapes
       - <p> for body text, <ul>/<li> for repeated rows
       - <button>, <a>, <input>, <label>, <form> when the design implies it
     Strip the wrapper divs Penpot emits when they only exist for grouping in the
     designer (they usually have type "frame" or "group" with no styling beyond
     layout).

  3. Preserve the layout intent — flexbox / grid / spacing / sizing — but express
     it idiomatically (e.g. Tailwind: flex items-center gap-4 px-6).

  4. Keep design tokens. If the project supports CSS variables, port the
     "tokensCss" :root block into a globals stylesheet and reference tokens via
     var(--token-name) (or the Tailwind theme equivalent). Do not inline raw hex
     values when a token name is available.

  5. Drop unnecessary positioning. The converter emits position:absolute /
     translate(...) for most shapes because Penpot is canvas-based. In production
     code, prefer normal flow + flex/grid; only keep absolute positioning when a
     visual overlap requires it.

  6. For images, replace <img> "src" with the project's preferred mechanism
     (local asset, next/image, etc.). The Penpot URL is included so you can
     download the asset.

The "get_current_selection" tool tells you what the user is looking at right now.
Call it first if you're unsure. Then use the more specific tool that matches the
user's intent.

When implementing a design from scratch (or reworking one), pair "get_screenshot"
with "get_current_html". The screenshot tells you what the design *looks like*
(spacing, hierarchy, what is a button vs a badge vs a card, where icons go); the
HTML tells you the exact tokens, fonts, sizes, and structure. Looking at only
one of the two will produce worse code.
`.trim();

const server = new McpServer(
  { name: 'penpot-viewer', version: '0.1.0' },
  { instructions: SERVER_INSTRUCTIONS },
);

const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });

const okImage = (base64: string, width: number, height: number, caption: string) => ({
  content: [
    { type: 'text' as const, text: `${caption} (${width}×${height} px)` },
    { type: 'image' as const, data: base64, mimeType: 'image/png' as const },
  ],
});

server.registerTool(
  'get_current_selection',
  {
    title: 'Get current Penpot dev-mode selection',
    description:
      'Returns the file, page and optional shape the user currently has open in the Penpot viewer (http://localhost:3000). Call this first when you are unsure what "the current page / selection" refers to.',
    inputSchema: {},
  },
  async () => {
    const sel = await requireSelection();
    return ok(JSON.stringify(sel, null, 2));
  },
);

server.registerTool(
  'get_current_html',
  {
    title: 'Get HTML for the current Penpot dev-mode selection',
    description:
      'Returns HTML for whatever the user is focused on in the viewer. If a shape is selected, returns just that shape; otherwise returns the full open page. Use this for prompts like "update the html with what I have in penpot dev mode".',
    inputSchema: {},
  },
  async () => {
    const token = await requireToken();
    const sel = await requireSelection();
    if (sel.shapeId) {
      const bundle = await convertShapeToHtml(token, sel.fileId, sel.pageId, sel.shapeId);
      return ok(describeShapeBundle(bundle));
    }
    const bundle = await convertPageToHtml(token, sel.fileId, sel.pageId);
    return ok(describePageBundle(bundle, 'full open page'));
  },
);

server.registerTool(
  'get_page_html',
  {
    title: 'Get HTML for the current page (ignores shape selection)',
    description:
      'Returns the full HTML of the page the user has open in the viewer, even when a shape is selected. Use this for prompts like "create the html of the page I have open".',
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
    let resolvedFile = fileId;
    let resolvedPage = pageId;
    if (!resolvedFile || !resolvedPage) {
      const sel = await requireSelection();
      resolvedFile ??= sel.fileId;
      resolvedPage ??= sel.pageId;
    }
    const bundle = await convertPageToHtml(token, resolvedFile, resolvedPage);
    return ok(describePageBundle(bundle, 'full open page'));
  },
);

server.registerTool(
  'get_page_tokens',
  {
    title: 'Get the design tokens used on the current page',
    description:
      'Returns every design token applied to any shape on the open page (colors, typography, spacing, radius, etc.) along with a ready-to-paste :root { ... } CSS block. Use this for prompts like "generate the tokens file for this page".',
    inputSchema: {
      fileId: z.string().uuid().optional(),
      pageId: z.string().uuid().optional(),
    },
  },
  async ({ fileId, pageId }) => {
    const token = await requireToken();
    let resolvedFile = fileId;
    let resolvedPage = pageId;
    if (!resolvedFile || !resolvedPage) {
      const sel = await requireSelection();
      resolvedFile ??= sel.fileId;
      resolvedPage ??= sel.pageId;
    }
    const bundle = await getPageTokens(token, resolvedFile, resolvedPage);
    const text = [
      `# Design tokens — page "${bundle.pageName}"`,
      '',
      'Port this :root block into a global stylesheet and reference tokens via var(--name).',
      'For Tailwind v4, paste it inside an `@theme { ... }` block (renaming --foo to --color-foo etc. as appropriate).',
      '',
      '## CSS',
      bundle.css ? '```css\n' + bundle.css + '\n```' : '_(no color/fill tokens)_',
      '',
      '## All token usages (JSON)',
      '```json',
      JSON.stringify(bundle.tokens, null, 2),
      '```',
    ].join('\n');
    return ok(text);
  },
);

server.registerTool(
  'get_page_overview',
  {
    title: 'Get a structural overview of the current page',
    description:
      'Returns the page name, top-level boards, shape counts, fonts, and most-used tokens. Use this for prompts like "give me a quick overview of the page in penpot dev mode" or "describe the functionality this design represents".',
    inputSchema: {
      fileId: z.string().uuid().optional(),
      pageId: z.string().uuid().optional(),
    },
  },
  async ({ fileId, pageId }) => {
    const token = await requireToken();
    let resolvedFile = fileId;
    let resolvedPage = pageId;
    if (!resolvedFile || !resolvedPage) {
      const sel = await requireSelection();
      resolvedFile ??= sel.fileId;
      resolvedPage ??= sel.pageId;
    }
    const overview = await getPageOverview(token, resolvedFile, resolvedPage);
    const text = [
      `# Page overview — "${overview.pageName}"`,
      '',
      `- File: ${overview.fileId}`,
      `- Page: ${overview.pageId}`,
      `- Total shapes: ${overview.totalShapes}`,
      `- Top-level boards: ${overview.topLevelBoards.length}`,
      `- Fonts in use: ${overview.fontsUsed.join(', ') || '(none)'}`,
      '',
      'Use this structural data to write a short, factual description of what the',
      'design depicts and what functionality it implies. Reference board names,',
      'visible text labels, and recurring patterns. Do not invent UX you cannot see.',
      '',
      '## Boards (depth-limited tree)',
      '```json',
      JSON.stringify(overview.topLevelBoards, null, 2),
      '```',
      '',
      '## Top tokens',
      '```json',
      JSON.stringify(overview.tokenSummary, null, 2),
      '```',
    ].join('\n');
    return ok(text);
  },
);

server.registerTool(
  'get_screenshot',
  {
    title: 'Render a screenshot of the current selection',
    description:
      'Renders the currently selected shape (or the full open page if no shape is selected) in headless Chromium and returns a PNG. Pair this with get_current_html when implementing or reworking a design — the image tells you the visual hierarchy and what each element really is, the HTML tells you the exact tokens/sizes/structure.',
    inputSchema: {
      target: z
        .enum(['auto', 'page', 'shape'])
        .optional()
        .describe(
          'auto (default): screenshot the selected shape if any, else the full page. page: always full page. shape: requires shapeId or a current shape selection.',
        ),
      shapeId: z
        .string()
        .optional()
        .describe(
          "Override the shape to screenshot; defaults to the viewer's current shape selection.",
        ),
      maxWidth: z.number().int().positive().max(4000).optional(),
      maxHeight: z.number().int().positive().max(10000).optional(),
    },
  },
  async ({ target = 'auto', shapeId, maxWidth, maxHeight }) => {
    const token = await requireToken();
    const sel = await requireSelection();
    const resolvedShape = shapeId ?? sel.shapeId;

    const wantShape = target === 'shape' || (target === 'auto' && !!resolvedShape);
    if (target === 'shape' && !resolvedShape) {
      throw new Error(
        'target="shape" requires a shapeId, either passed in or selected in the viewer.',
      );
    }

    const bundle =
      wantShape && resolvedShape
        ? await convertShapeToHtml(token, sel.fileId, sel.pageId, resolvedShape)
        : await convertPageToHtml(token, sel.fileId, sel.pageId);

    const shot = await renderScreenshot({
      html: bundle.html,
      tokensCss: bundle.tokensCss,
      fontsCss: bundle.fontsCss,
      maxWidth,
      maxHeight,
    });

    const caption =
      wantShape && resolvedShape
        ? `Penpot screenshot — shape ${resolvedShape} on page "${bundle.pageName}"`
        : `Penpot screenshot — full page "${bundle.pageName}"`;

    return okImage(shot.base64, shot.width, shot.height, caption);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
