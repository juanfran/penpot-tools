import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { htmlToChanges } from '@penpot-tools/html-to-penpot';
import type { Uuid } from '@penpot-tools/converter/types';
import { z } from 'zod';
import { getFileMeta, PenpotConflictError, updateFile } from '../../penpot-api.ts';
import { requireSelection, requireToken } from '../../state.ts';

const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });

export function registerCreateFromHtmlTool(server: McpServer): void {
  server.registerTool(
    'create_design_from_html',
    {
      title: 'Create a Penpot board from an HTML snippet',
      description:
        'Renders HTML in headless Chromium and creates a new top-level board with one shape per visible element. Send a fragment (the tool auto-strips `<!DOCTYPE>`/`<html>`/`<body>`) and set `data-name="..."` on every element so layers have meaningful names. The response includes a `## Warnings` section listing every CSS declaration that was dropped — read it before declaring the design done. See `penpot://write-guide` for the supported subset.',
      inputSchema: {
        html: z.string().min(1).describe('HTML document or fragment.'),
        name: z.string().optional().describe('Name for the new board.'),
        position: z
          .object({ x: z.number(), y: z.number() })
          .optional()
          .describe('Page-absolute origin (defaults to (0, 0)).'),
        fileId: z.string().uuid().optional(),
        pageId: z.string().uuid().optional(),
      },
    },
    async ({ html, name, position, fileId, pageId }) => {
      const token = await requireToken();
      let resolvedFile = fileId;
      let resolvedPage = pageId;
      if (!resolvedFile || !resolvedPage) {
        const sel = await requireSelection();
        resolvedFile ??= sel.fileId;
        resolvedPage ??= sel.pageId;
      }

      const meta = await getFileMeta(token, resolvedFile);

      const bundle = await htmlToChanges(html, {
        pageId: resolvedPage as Uuid,
        rootName: name ?? 'New design',
        rootPosition: position,
      });

      try {
        const result = await updateFile(
          token,
          resolvedFile,
          meta.revn,
          meta.vern,
          bundle.changes,
        );
        const summary = [
          `# Created board "${name ?? 'New design'}"`,
          '',
          `- File: ${resolvedFile}`,
          `- Page: ${resolvedPage}`,
          `- Board id: ${bundle.rootShapeId}`,
          `- Shapes created: ${bundle.createdShapeIds.length}`,
          `- New file revn: ${result.revn}`,
          bundle.warnings.length
            ? `\n## Warnings\n${bundle.warnings.map((w) => `- ${w}`).join('\n')}`
            : '',
          '',
          'Refresh the Penpot viewer to see the result.',
        ]
          .filter(Boolean)
          .join('\n');
        return ok(summary);
      } catch (err) {
        if (err instanceof PenpotConflictError) {
          return ok(
            `# update-file conflict\n\n${err.message}\n\nReload your selection in the viewer and call this tool again.`,
          );
        }
        throw err;
      }
    },
  );
}
