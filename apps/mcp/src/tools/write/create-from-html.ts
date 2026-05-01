import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { htmlToChanges } from '@penpot-tools/html-to-penpot';
import type { Uuid } from '@penpot-tools/converter/types';
import { z } from 'zod';
import { getFileMeta, PenpotConflictError, updateFile } from '../../penpot-api.ts';
import type { McpContentBlock } from '../../screenshot.ts';
import { requireSelection, requireToken } from '../../state.ts';
import { shapeScreenshotContent } from './screenshot.ts';

const okText = (text: string) => ({ content: [{ type: 'text' as const, text }] });

export function registerCreateFromHtmlTool(server: McpServer): void {
  server.registerTool(
    'create_design_from_html',
    {
      title: 'Create a Penpot board from an HTML snippet',
      description:
        'Renders HTML in headless Chromium and creates a new top-level board with one shape per visible element. Send a fragment (`<!DOCTYPE>`/`<html>`/`<body>` are auto-stripped) and set `data-name="..."` on every element so layers have meaningful names. The response includes a `## Warnings` section listing every CSS declaration that was dropped — read it before declaring the design done. Pass `includeScreenshot:true` to get a PNG of the result back in the same call (skips the follow-up `get_screenshot`). The condensed CSS subset lives in the server `instructions`; full reference at `penpot://write-guide`.',
      inputSchema: {
        html: z.string().min(1).describe('HTML document or fragment.'),
        name: z.string().optional().describe('Name for the new board.'),
        position: z
          .object({ x: z.number(), y: z.number() })
          .optional()
          .describe('Page-absolute origin (defaults to (0, 0)).'),
        includeScreenshot: z
          .boolean()
          .optional()
          .describe(
            'When true, render the resulting board and return a PNG alongside the text summary (saves a follow-up `get_screenshot` round-trip). Default false.',
          ),
        fileId: z.string().uuid().optional(),
        pageId: z.string().uuid().optional(),
      },
    },
    async ({ html, name, position, includeScreenshot, fileId, pageId }) => {
      const token = await requireToken();
      let resolvedFile = fileId;
      let resolvedPage = pageId;
      if (!resolvedFile || !resolvedPage) {
        const sel = await requireSelection();
        resolvedFile ??= sel.fileId;
        resolvedPage ??= sel.pageId;
      }

      const meta = await getFileMeta(token, resolvedFile);

      const boardName = name ?? 'New design';
      const bundle = await htmlToChanges(html, {
        pageId: resolvedPage as Uuid,
        rootName: boardName,
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
          `# Created board "${boardName}"`,
          '',
          `- File: ${resolvedFile}`,
          `- Page: ${resolvedPage}`,
          `- Board id: ${bundle.rootShapeId}`,
          `- Shapes created: ${bundle.createdShapeIds.length}`,
          `- New file revn: ${result.revn}`,
          bundle.warnings.length
            ? `\n## Warnings\n${bundle.warnings.map((w) => `- ${w}`).join('\n')}`
            : '\n_No warnings — every authored CSS declaration was applied._',
          '',
          'Refresh the Penpot viewer to see the result.',
        ]
          .filter(Boolean)
          .join('\n');

        const content: McpContentBlock[] = [{ type: 'text', text: summary }];
        if (includeScreenshot) {
          const shot = await shapeScreenshotContent(
            token,
            resolvedFile,
            resolvedPage,
            bundle.rootShapeId,
            `Penpot screenshot — board "${boardName}" (id ${bundle.rootShapeId})`,
          );
          content.push(...shot);
        }
        return { content };
      } catch (err) {
        if (err instanceof PenpotConflictError) {
          return okText(
            `# update-file conflict\n\n${err.message}\n\nReload your selection in the viewer and call this tool again.`,
          );
        }
        throw err;
      }
    },
  );
}
