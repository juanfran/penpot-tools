import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FileChange, Uuid } from '@penpot-tools/converter/types';
import { z } from 'zod';
import { getFileMeta, PenpotConflictError, updateFile } from '../../penpot-api.ts';
import { requireSelection, requireToken } from '../../state.ts';

const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });

/**
 * Slots accepted by Penpot's `applied-tokens` (DimensionsTokenAttrs). Kept as a
 * literal union so the LLM gets useful autocomplete and we reject typos early.
 */
const Slot = z.enum([
  'fill',
  'strokeColor',
  'strokeWidth',
  'shadow',
  'r1',
  'r2',
  'r3',
  'r4',
  'width',
  'height',
  'layoutItemMinW',
  'layoutItemMaxW',
  'layoutItemMinH',
  'layoutItemMaxH',
  'rowGap',
  'columnGap',
  'p1',
  'p2',
  'p3',
  'p4',
  'm1',
  'm2',
  'm3',
  'm4',
  'rotation',
  'fontSize',
  'fontFamily',
  'lineHeight',
  'letterSpacing',
  'textCase',
  'textDecoration',
]);

interface ModObjChange {
  type: 'mod-obj';
  id: Uuid;
  pageId: Uuid;
  operations: Array<{
    type: 'set';
    attr: string;
    val: unknown;
    ignoreTouched?: boolean;
  }>;
}

export function registerApplyTokenTool(server: McpServer): void {
  server.registerTool(
    'apply_token',
    {
      title: 'Apply tokens to shape slots via mod-obj',
      description:
        'Sets appliedTokens.<slot> for the given (slot, tokenName) pairs. The tokens must already exist (call create_token_set first).',
      inputSchema: {
        shapeId: z.string().uuid().optional(),
        applications: z
          .array(z.object({ slot: Slot, tokenName: z.string().min(1) }))
          .min(1)
          .describe('One {slot, tokenName} per attribute.'),
        fileId: z.string().uuid().optional(),
        pageId: z.string().uuid().optional(),
      },
    },
    async ({ shapeId, applications, fileId, pageId }) => {
      const token = await requireToken();
      const sel = await requireSelection();
      const resolvedFile = fileId ?? sel.fileId;
      const resolvedPage = pageId ?? sel.pageId;
      const resolvedShape = shapeId ?? sel.shapeId;
      if (!resolvedShape) {
        return ok(
          '# No shape selected\n\nPick the shape in the viewer or pass `shapeId` explicitly.',
        );
      }

      const meta = await getFileMeta(token, resolvedFile);

      // Penpot stores applied tokens as a single map under `applied-tokens`.
      // We can't read the existing map without an extra get-page round trip,
      // so each `apply_token` call REPLACES the map. The LLM should pass the
      // full set of slot/token pairs it wants on the shape.
      const appliedTokens: Record<string, string> = {};
      for (const a of applications) appliedTokens[a.slot] = a.tokenName;

      const change: ModObjChange = {
        type: 'mod-obj',
        id: resolvedShape as Uuid,
        pageId: resolvedPage as Uuid,
        operations: [
          { type: 'set', attr: 'appliedTokens', val: appliedTokens, ignoreTouched: true },
        ],
      };

      try {
        const result = await updateFile(token, resolvedFile, meta.revn, meta.vern, [
          change as unknown as FileChange,
        ]);
        const lines = applications.map((a) => `- ${a.slot} → \`${a.tokenName}\``);
        return ok(
          [
            `# Applied tokens to shape ${resolvedShape} (revn ${result.revn})`,
            '',
            ...lines,
            '',
            'Refresh the viewer to see the resolved color / value.',
          ].join('\n'),
        );
      } catch (err) {
        if (err instanceof PenpotConflictError) {
          return ok(`# update-file conflict\n\n${err.message}\n\nReload selection and retry.`);
        }
        throw err;
      }
    },
  );
}
