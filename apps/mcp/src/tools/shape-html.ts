import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { convertShapeToHtml } from '../convert.ts';
import { describeShapeBundle } from '../format.ts';
import { requireSelection, requireToken } from '../state.ts';

export function registerShapeHtmlTool(server: McpServer): void {
  server.registerTool(
    'get_shape_html',
    {
      title: 'Get HTML for a specific Penpot shape by id',
      description:
        'Returns HTML for an arbitrary shape by id, independent of what the user has selected in the viewer. Use this after `get_page_overview` to extract one of the listed boards (e.g. "give me the HTML for the Header board"). fileId/pageId default to the viewer\'s current selection.',
      inputSchema: {
        shapeId: z
          .string()
          .describe('The shape id to convert (e.g. a board id from get_page_overview).'),
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
    async ({ shapeId, fileId, pageId }) => {
      const token = await requireToken();
      let resolvedFile = fileId;
      let resolvedPage = pageId;
      if (!resolvedFile || !resolvedPage) {
        const sel = await requireSelection();
        resolvedFile ??= sel.fileId;
        resolvedPage ??= sel.pageId;
      }
      const bundle = await convertShapeToHtml(token, resolvedFile, resolvedPage, shapeId);
      return { content: [{ type: 'text' as const, text: describeShapeBundle(bundle) }] };
    },
  );
}
