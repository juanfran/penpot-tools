import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { htmlToChanges } from '@penpot-tools/html-to-penpot';
import type { FileChange, Shape, Uuid } from '@penpot-tools/converter/types';
import { z } from 'zod';
import { fetchPage, getFileMeta, PenpotConflictError, updateFile } from '../../penpot-api.ts';
import type { McpContentBlock } from '../../screenshot.ts';
import { requireSelection, requireToken } from '../../state.ts';
import { shapeScreenshotContent } from './screenshot.ts';

const okText = (text: string) => ({ content: [{ type: 'text' as const, text }] });

interface DelObjChange {
  type: 'del-obj';
  id: Uuid;
  pageId: Uuid;
  ignoreTouched?: boolean;
}

/** Walk all descendants of `rootId` (inclusive) in `objects`. */
function collectSubtree(objects: Record<string, Shape>, rootId: string): Shape[] {
  const out: Shape[] = [];
  const stack: string[] = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    const shape = objects[id];
    if (!shape) continue;
    out.push(shape);
    const children = (shape as Shape & { shapes?: Uuid[] }).shapes;
    if (children) for (const c of children) stack.push(c);
  }
  return out;
}

export function registerUpdateSelectionFromHtmlTool(server: McpServer): void {
  server.registerTool(
    'update_selection_from_html',
    {
      title: 'Replace the selected shape with a new HTML design',
      description:
        'Replaces the selected shape (and descendants) with a fresh subtree at the same position. The new shape gets a new id. Send a fragment (`<!DOCTYPE>`/`<html>`/`<body>` are auto-stripped) and set `data-name="..."` on every element. The response includes a `## Warnings` section listing dropped CSS — read it. Pass `includeScreenshot:true` to get a PNG of the result back in the same call (skips the follow-up `get_screenshot`). The condensed CSS subset lives in the server `instructions`; full reference at `penpot://write-guide`. For single-attribute tweaks use modify_shape.',
      inputSchema: {
        html: z.string().min(1).describe('Replacement HTML+CSS.'),
        name: z.string().optional(),
        includeScreenshot: z
          .boolean()
          .optional()
          .describe(
            'When true, render the resulting shape and return a PNG alongside the text summary (saves a follow-up `get_screenshot` round-trip). Default false.',
          ),
        fileId: z.string().uuid().optional(),
        pageId: z.string().uuid().optional(),
        shapeId: z.string().uuid().optional(),
      },
    },
    async ({ html, name, includeScreenshot, fileId, pageId, shapeId }) => {
      const token = await requireToken();
      const sel = await requireSelection();
      const resolvedFile = fileId ?? sel.fileId;
      const resolvedPage = pageId ?? sel.pageId;
      const resolvedShape = shapeId ?? sel.shapeId;
      if (!resolvedShape) {
        return okText(
          '# No shape selected\n\nPick the shape you want to replace in the viewer, then call this tool again.',
        );
      }

      const page = await fetchPage(token, resolvedFile, resolvedPage);
      const target = page.objects[resolvedShape];
      if (!target) {
        return okText(
          `# Shape not found\n\nShape ${resolvedShape} is not on page ${resolvedPage}.`,
        );
      }
      const anchorX = target.x ?? target.selrect.x;
      const anchorY = target.y ?? target.selrect.y;
      const parentId = (target.parentId ?? '00000000-0000-0000-0000-000000000000') as Uuid;

      // Capture the deleted shape's sibling index so the replacement keeps the
      // same z-order. Without this the new shape gets appended to the parent's
      // `shapes` array, which silently changes paint order — a real bug seen
      // in the wild when an LLM patched a single text inside a card and the
      // labels rearranged.
      const parentShape = page.objects[parentId] as
        | (typeof target & { shapes?: Uuid[] })
        | undefined;
      const originalSiblingIndex = parentShape?.shapes?.indexOf(resolvedShape as Uuid) ?? -1;

      const meta = await getFileMeta(token, resolvedFile);

      const bundle = await htmlToChanges(html, {
        pageId: resolvedPage as Uuid,
        rootName: name ?? target.name ?? 'Replacement',
        rootPosition: { x: anchorX, y: anchorY },
        parentId,
      });

      // Override the root shape's add-obj `index` to land at the deleted
      // shape's original slot. Subsequent shapes are descendants going into
      // freshly-empty parents, so their order is already correct.
      if (originalSiblingIndex >= 0 && bundle.changes.length > 0) {
        const firstAdd = bundle.changes[0] as { type?: string; index?: number };
        if (firstAdd.type === 'add-obj') firstAdd.index = originalSiblingIndex;
      }

      const subtree = collectSubtree(page.objects, resolvedShape);
      const delChanges: FileChange[] = subtree.map((s) => {
        const change: DelObjChange = {
          type: 'del-obj',
          id: s.id,
          pageId: resolvedPage as Uuid,
          ignoreTouched: true,
        };
        return change as unknown as FileChange;
      });

      const changes: FileChange[] = [...delChanges, ...bundle.changes];

      try {
        const result = await updateFile(
          token,
          resolvedFile,
          meta.revn,
          meta.vern,
          changes,
        );
        const replacementName = name ?? target.name ?? resolvedShape;
        const summary = [
          `# Replaced shape "${target.name ?? resolvedShape}"`,
          '',
          `- Old shape (and ${subtree.length - 1} descendants): deleted`,
          `- New top-level shape: ${bundle.rootShapeId} (${bundle.createdShapeIds.length} shapes)`,
          `- New file revn: ${result.revn}`,
          bundle.warnings.length
            ? `\n## Warnings\n${bundle.warnings.map((w) => `- ${w}`).join('\n')}`
            : '\n_No warnings — every authored CSS declaration was applied._',
          '',
          'Refresh the viewer to see the replacement.',
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
            `Penpot screenshot — replacement "${replacementName}" (id ${bundle.rootShapeId})`,
          );
          content.push(...shot);
        }
        return { content };
      } catch (err) {
        if (err instanceof PenpotConflictError) {
          return okText(
            `# update-file conflict\n\n${err.message}\n\nReload your selection and try again.`,
          );
        }
        throw err;
      }
    },
  );
}
