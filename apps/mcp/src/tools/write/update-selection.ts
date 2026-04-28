import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { htmlToChanges } from '@penpot-tools/html-to-penpot';
import type { FileChange, Shape, Uuid } from '@penpot-tools/converter/types';
import { z } from 'zod';
import { fetchPage, getFileMeta, PenpotConflictError, updateFile } from '../../penpot-api.ts';
import { requireSelection, requireToken } from '../../state.ts';

const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });

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
      title: 'Replace the currently-selected shape with a new HTML design',
      description: [
        'Replaces the shape the user has selected in the viewer (and all its descendants)',
        'with a fresh subtree built from the provided HTML, anchored at the same on-page',
        'position. Useful for "modify the header" / "redesign this card" prompts when the',
        'change is structural enough that surgical mods would be brittle. The selected',
        'shape id changes — the replacement gets a new id. For tweaks of a single',
        'attribute (color, radius, text), use modify_shape instead (lighter, preserves id).',
      ].join(' '),
      inputSchema: {
        html: z.string().min(1).describe('HTML+CSS to materialize as the replacement.'),
        name: z.string().optional().describe('Name for the new top-level shape.'),
        fileId: z.string().uuid().optional(),
        pageId: z.string().uuid().optional(),
        shapeId: z.string().uuid().optional(),
      },
    },
    async ({ html, name, fileId, pageId, shapeId }) => {
      const token = await requireToken();
      const sel = await requireSelection();
      const resolvedFile = fileId ?? sel.fileId;
      const resolvedPage = pageId ?? sel.pageId;
      const resolvedShape = shapeId ?? sel.shapeId;
      if (!resolvedShape) {
        return ok(
          '# No shape selected\n\nPick the shape you want to replace in the viewer, then call this tool again.',
        );
      }

      const page = await fetchPage(token, resolvedFile, resolvedPage);
      const target = page.objects[resolvedShape];
      if (!target) {
        return ok(`# Shape not found\n\nShape ${resolvedShape} is not on page ${resolvedPage}.`);
      }
      const anchorX = target.x ?? target.selrect.x;
      const anchorY = target.y ?? target.selrect.y;
      const parentId = (target.parentId ?? '00000000-0000-0000-0000-000000000000') as Uuid;

      const meta = await getFileMeta(token, resolvedFile);

      const bundle = await htmlToChanges(html, {
        pageId: resolvedPage as Uuid,
        rootName: name ?? target.name ?? 'Replacement',
        rootPosition: { x: anchorX, y: anchorY },
        parentId,
      });

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
        const summary = [
          `# Replaced shape "${target.name ?? resolvedShape}"`,
          '',
          `- Old shape (and ${subtree.length - 1} descendants): deleted`,
          `- New top-level shape: ${bundle.rootShapeId} (${bundle.createdShapeIds.length} shapes)`,
          `- New file revn: ${result.revn}`,
          bundle.warnings.length
            ? `\n## Warnings\n${bundle.warnings.map((w) => `- ${w}`).join('\n')}`
            : '',
          '',
          'Refresh the viewer to see the replacement.',
        ]
          .filter(Boolean)
          .join('\n');
        return ok(summary);
      } catch (err) {
        if (err instanceof PenpotConflictError) {
          return ok(
            `# update-file conflict\n\n${err.message}\n\nReload your selection and try again.`,
          );
        }
        throw err;
      }
    },
  );
}
