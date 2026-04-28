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
import { registerGuideResources } from './resources.ts';
import { registerApplyTokenTool } from './tools/write/apply-token.ts';
import { registerCreateFromHtmlTool } from './tools/write/create-from-html.ts';
import { registerCreateTokenSetTool } from './tools/write/create-token-set.ts';
import { registerModifyShapeTool } from './tools/write/modify-shape.ts';
import { registerUpdateSelectionFromHtmlTool } from './tools/write/update-selection.ts';
import { registerUploadMediaTool } from './tools/write/upload-media.ts';

const SERVER_INSTRUCTIONS = `
Tools to read and write the Penpot file the user has open in the dev-mode viewer
(http://localhost:3000). The current file/page/shape selection is tracked by the
viewer — call \`get_current_selection\` if unsure; do NOT ask the user for IDs.

Read tools (\`get_current_html\`, \`get_page_html\`, \`get_screenshot\`,
\`get_page_overview\`, \`get_page_tokens\`) return raw inline-styled HTML +
tokensCss + fontsCss. Convert to the user's target framework — do NOT paste
verbatim. Pair \`get_screenshot\` with \`get_current_html\` when implementing
or reworking: image gives hierarchy, HTML gives exact tokens/sizes.

Write tools (\`create_design_from_html\`, \`update_selection_from_html\`,
\`modify_shape\`, \`apply_token\`, \`create_token_set\`, \`upload_media\`) push
changes via Penpot's REST API. The user must refresh the viewer to see results.
HTML is rendered in headless Chromium; only a CSS subset is honoured.

For framework conversion guidance fetch \`penpot://convert-guide\`.
For the supported CSS subset, token format, write workflow and concurrency
notes fetch \`penpot://write-guide\`.
`.trim();

const server = new McpServer(
  { name: 'penpot-viewer', version: '0.1.0' },
  { instructions: SERVER_INSTRUCTIONS },
);

const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });

interface ImageMeta {
  base64: string;
  width: number;
  height: number;
  fullWidth?: number;
  fullHeight?: number;
  trimmed?: boolean;
}

const okImage = (img: ImageMeta, caption: string) => {
  const sizeNote =
    img.trimmed && img.fullWidth && img.fullHeight
      ? `${caption} (${img.width}×${img.height} px — trimmed from ${img.fullWidth}×${img.fullHeight}; pass maxWidth/maxHeight to see more)`
      : `${caption} (${img.width}×${img.height} px)`;
  return {
    content: [
      { type: 'text' as const, text: sizeNote },
      { type: 'image' as const, data: img.base64, mimeType: 'image/png' as const },
    ],
  };
};

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
  'get_current_html',
  {
    title: 'HTML for the current selection',
    description:
      'Selected shape if any, else the full page. See `penpot://convert-guide` before pasting into framework code.',
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
    title: 'HTML for the current page',
    description: 'Full page HTML even if a shape is selected.',
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
    const bundle = await convertPageToHtml(token, resolvedFile, resolvedPage);
    return ok(describePageBundle(bundle, 'full open page'));
  },
);

server.registerTool(
  'get_page_tokens',
  {
    title: 'Design tokens applied on the current page',
    description: 'Tokens (colors, typography, spacing, radius, ...) plus a ready-to-paste :root { ... } block.',
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
    let resolvedFile = fileId;
    let resolvedPage = pageId;
    if (!resolvedFile || !resolvedPage) {
      const sel = await requireSelection();
      resolvedFile ??= sel.fileId;
      resolvedPage ??= sel.pageId;
    }
    const overview = await getPageOverview(token, resolvedFile, resolvedPage, {
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
      'Selected shape if any, else the full page. Defaults to a 1600×2000 cap; output is auto-trimmed and the caption flags it. Raise maxWidth/maxHeight only when needed.',
    inputSchema: {
      target: z
        .enum(['auto', 'page', 'shape'])
        .optional()
        .describe('auto (default) | page | shape.'),
      shapeId: z.string().optional(),
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

    return okImage(shot, caption);
  },
);

registerGuideResources(server);
registerApplyTokenTool(server);
registerCreateFromHtmlTool(server);
registerCreateTokenSetTool(server);
registerModifyShapeTool(server);
registerUpdateSelectionFromHtmlTool(server);
registerUploadMediaTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);
