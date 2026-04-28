import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FileChange, HexColor, Uuid } from '@penpot-tools/converter/types';
import { z } from 'zod';
import { getFileMeta, PenpotConflictError, updateFile } from '../../penpot-api.ts';
import { requireSelection, requireToken } from '../../state.ts';

const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });

const Hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{3,8}$/, 'Expected a hex color like "#RRGGBB" or "#RGB"');

const FillInput = z.union([
  z.object({
    color: Hex,
    opacity: z.number().min(0).max(1).optional(),
  }),
  z.object({ tokenName: z.string().min(1) }),
]);

const StrokeInput = z.object({
  color: Hex.optional(),
  tokenName: z.string().min(1).optional(),
  width: z.number().nonnegative().optional(),
  alignment: z.enum(['inner', 'center', 'outer']).optional(),
  style: z.enum(['solid', 'dashed', 'dotted']).optional(),
});

const RadiusInput = z.union([
  z.number().nonnegative(),
  z.object({
    tl: z.number().nonnegative().optional(),
    tr: z.number().nonnegative().optional(),
    br: z.number().nonnegative().optional(),
    bl: z.number().nonnegative().optional(),
  }),
]);

const LayoutInput = z.object({
  type: z.enum(['flex', 'grid', 'none']).optional(),
  direction: z.enum(['row', 'column', 'row-reverse', 'column-reverse']).optional(),
  gap: z.union([z.number().nonnegative(), z.tuple([z.number(), z.number()])]).optional(),
  padding: z
    .union([z.number().nonnegative(), z.tuple([z.number(), z.number(), z.number(), z.number()])])
    .optional(),
  justify: z
    .enum(['start', 'center', 'end', 'stretch', 'space-between', 'space-around', 'space-evenly'])
    .optional(),
  align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
});

const OpsInput = z.object({
  fill: FillInput.optional(),
  stroke: StrokeInput.optional(),
  radius: RadiusInput.optional(),
  layout: LayoutInput.optional(),
  name: z.string().min(1).optional(),
  visible: z.boolean().optional(),
  locked: z.boolean().optional(),
  opacity: z.number().min(0).max(1).optional(),
});

interface SetOp {
  type: 'set';
  attr: string;
  val: unknown;
  ignoreTouched?: boolean;
}

interface ModObjChange {
  type: 'mod-obj';
  id: Uuid;
  pageId: Uuid;
  operations: SetOp[];
}

const SET = (attr: string, val: unknown): SetOp => ({
  type: 'set',
  attr,
  val,
  ignoreTouched: true,
});

function buildOperations(ops: z.infer<typeof OpsInput>): { ops: SetOp[]; applied: string[] } {
  const out: SetOp[] = [];
  const applied: string[] = [];

  if (ops.fill) {
    if ('tokenName' in ops.fill) {
      // Apply the token reference. We can't read the existing fill without an
      // extra fetch, so we leave the fills array untouched (the token resolves
      // server-side via the tokens-lib). If the shape has no fill yet, the
      // viewer may show empty until the token's value is rendered; pair this
      // op with a `color` fallback for safety.
      out.push(SET('appliedTokens', { fill: ops.fill.tokenName }));
      applied.push(`fill → token "${ops.fill.tokenName}"`);
    } else {
      const fill = {
        fillColor: ops.fill.color as HexColor,
        ...(ops.fill.opacity !== undefined ? { fillOpacity: ops.fill.opacity } : { fillOpacity: 1 }),
      };
      out.push(SET('fills', [fill]));
      applied.push(`fill → ${ops.fill.color}`);
    }
  }

  if (ops.stroke) {
    const stroke: Record<string, unknown> = {
      strokeStyle: ops.stroke.style ?? 'solid',
      strokeAlignment: ops.stroke.alignment ?? 'inner',
    };
    if (ops.stroke.width !== undefined) stroke['strokeWidth'] = ops.stroke.width;
    if (ops.stroke.color) stroke['strokeColor'] = ops.stroke.color;
    out.push(SET('strokes', [stroke]));
    if (ops.stroke.tokenName) {
      out.push(SET('appliedTokens', { strokeColor: ops.stroke.tokenName }));
    }
    applied.push(
      `stroke → ${ops.stroke.color ?? ops.stroke.tokenName ?? 'unchanged color'}` +
        (ops.stroke.width !== undefined ? ` ${ops.stroke.width}px` : ''),
    );
  }

  if (ops.radius !== undefined) {
    if (typeof ops.radius === 'number') {
      const r = ops.radius;
      out.push(SET('r1', r), SET('r2', r), SET('r3', r), SET('r4', r));
      applied.push(`radius → ${r}px`);
    } else {
      const corners: [keyof typeof ops.radius, string][] = [
        ['tl', 'r1'],
        ['tr', 'r2'],
        ['br', 'r3'],
        ['bl', 'r4'],
      ];
      const labels: string[] = [];
      for (const [src, dst] of corners) {
        const v = ops.radius[src];
        if (v !== undefined) {
          out.push(SET(dst, v));
          labels.push(`${src}=${v}`);
        }
      }
      applied.push(`radius → ${labels.join(' ')}`);
    }
  }

  if (ops.layout) {
    if (ops.layout.type !== undefined) {
      out.push(SET('layoutType', ops.layout.type === 'none' ? null : ops.layout.type));
      applied.push(`layout.type → ${ops.layout.type}`);
    }
    if (ops.layout.direction) {
      out.push(SET('layoutFlexDir', ops.layout.direction));
      applied.push(`layout.direction → ${ops.layout.direction}`);
    }
    if (ops.layout.gap !== undefined) {
      if (typeof ops.layout.gap === 'number') {
        out.push(SET('layoutRowGap', ops.layout.gap), SET('layoutColumnGap', ops.layout.gap));
        applied.push(`layout.gap → ${ops.layout.gap}px`);
      } else {
        const [r, c] = ops.layout.gap;
        out.push(SET('layoutRowGap', r), SET('layoutColumnGap', c));
        applied.push(`layout.gap → ${r}/${c}px`);
      }
    }
    if (ops.layout.padding !== undefined) {
      if (typeof ops.layout.padding === 'number') {
        const p = ops.layout.padding;
        out.push(
          SET('layoutPadding', { p1: p, p2: p, p3: p, p4: p }),
          SET('layoutPaddingType', 'simple'),
        );
        applied.push(`layout.padding → ${p}px`);
      } else {
        const [t, r, b, l] = ops.layout.padding;
        out.push(
          SET('layoutPadding', { p1: t, p2: r, p3: b, p4: l }),
          SET('layoutPaddingType', 'multiple'),
        );
        applied.push(`layout.padding → ${t}/${r}/${b}/${l}px`);
      }
    }
    if (ops.layout.justify) {
      out.push(SET('layoutJustifyContent', ops.layout.justify));
      applied.push(`layout.justify → ${ops.layout.justify}`);
    }
    if (ops.layout.align) {
      out.push(SET('layoutAlignItems', ops.layout.align));
      applied.push(`layout.align → ${ops.layout.align}`);
    }
  }

  if (ops.name) {
    out.push(SET('name', ops.name));
    applied.push(`name → "${ops.name}"`);
  }
  if (ops.visible !== undefined) {
    out.push(SET('hidden', !ops.visible));
    applied.push(`visible → ${ops.visible}`);
  }
  if (ops.locked !== undefined) {
    out.push(SET('locked', ops.locked));
    applied.push(`locked → ${ops.locked}`);
  }
  if (ops.opacity !== undefined) {
    out.push(SET('opacity', ops.opacity));
    applied.push(`opacity → ${ops.opacity}`);
  }

  return { ops: out, applied };
}

export function registerModifyShapeTool(server: McpServer): void {
  server.registerTool(
    'modify_shape',
    {
      title: 'Surgical mod-obj on a Penpot shape',
      description:
        'Emits one mod-obj with the given set ops. Fastest path for fill / stroke / radius / layout / opacity / name / visible tweaks. Use update_selection_from_html for structural changes.',
      inputSchema: {
        shapeId: z.string().uuid().optional(),
        ops: OpsInput.describe('Attributes to update; pass only what changes.'),
        fileId: z.string().uuid().optional(),
        pageId: z.string().uuid().optional(),
      },
    },
    async ({ shapeId, ops, fileId, pageId }) => {
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

      const { ops: setOps, applied } = buildOperations(ops);
      if (setOps.length === 0) {
        return ok('# No-op\n\nProvide at least one attribute under `ops`.');
      }

      const meta = await getFileMeta(token, resolvedFile);
      const change: ModObjChange = {
        type: 'mod-obj',
        id: resolvedShape as Uuid,
        pageId: resolvedPage as Uuid,
        operations: setOps,
      };

      try {
        const result = await updateFile(token, resolvedFile, meta.revn, meta.vern, [
          change as unknown as FileChange,
        ]);
        return ok(
          [
            `# Modified shape ${resolvedShape} (revn ${result.revn})`,
            '',
            ...applied.map((l) => `- ${l}`),
            '',
            'Refresh the viewer to confirm.',
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
