import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  type DtcgToken,
  type DtcgTokensLib,
  getFileMeta,
  PenpotConflictError,
  setTokensLib,
} from '../../penpot-api.ts';
import { requireSelection, requireToken } from '../../state.ts';

const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });

const TokenInput = z.object({
  name: z.string().min(1),
  type: z.enum(['color', 'border-radius', 'spacing', 'sizing', 'opacity', 'dimension']),
  value: z.union([z.string(), z.number()]),
  description: z.string().optional(),
});

const SetInput = z.object({
  setName: z.string().min(1),
  tokens: z.array(TokenInput).min(1),
});

export function registerCreateTokenSetTool(server: McpServer): void {
  server.registerTool(
    'create_token_set',
    {
      title: 'Create or replace the file tokens-lib',
      description:
        'Replaces the file tokens-lib with the given DTCG sets — pass every set you want to keep. Reference from HTML as `var(--name, fallback)`.',
      inputSchema: {
        sets: z.array(SetInput).min(1),
        fileId: z.string().uuid().optional(),
      },
    },
    async ({ sets, fileId }) => {
      const token = await requireToken();
      let resolvedFile = fileId;
      if (!resolvedFile) {
        const sel = await requireSelection();
        resolvedFile = sel.fileId;
      }

      const lib: DtcgTokensLib = {};
      for (const set of sets) {
        const tokens: Record<string, DtcgToken> = {};
        for (const t of set.tokens) {
          tokens[t.name] = {
            $type: t.type,
            $value: t.value,
            ...(t.description ? { $description: t.description } : {}),
          };
        }
        lib[set.setName] = tokens;
      }

      const meta = await getFileMeta(token, resolvedFile);
      try {
        const result = await setTokensLib(token, resolvedFile, meta.revn, meta.vern, lib);
        const lines = sets.map(
          (s) => `- ${s.setName}: ${s.tokens.map((t) => `${t.name}=${t.value}`).join(', ')}`,
        );
        return ok(
          [
            `# Tokens-lib updated (new revn ${result.revn})`,
            '',
            ...lines,
            '',
            'Reference these from HTML via `var(--<name>, <fallback>)` — the converter and',
            'create_design_from_html will read both the var name (for appliedTokens) and the',
            'fallback (for the visual render).',
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
