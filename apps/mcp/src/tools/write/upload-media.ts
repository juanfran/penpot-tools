import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { uploadFileMedia } from '../../penpot-api.ts';
import { requireSelection, requireToken } from '../../state.ts';

const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });

export function registerUploadMediaTool(server: McpServer): void {
  server.registerTool(
    'upload_media',
    {
      title: 'Upload local images and return media ids',
      description:
        'Uploads png/jpg/jpeg/gif/webp/svg files to the open Penpot file. Reference each id from HTML via `data-penpot-media-id="<id>"` on the `<img>`.',
      inputSchema: {
        paths: z.array(z.string().min(1)).min(1).describe('Image paths (absolute or relative to MCP cwd).'),
        fileId: z.string().uuid().optional(),
      },
    },
    async ({ paths, fileId }) => {
      const token = await requireToken();
      let resolvedFile = fileId;
      if (!resolvedFile) {
        const sel = await requireSelection();
        resolvedFile = sel.fileId;
      }

      const results: Array<{
        path: string;
        id?: string;
        mediaType?: string;
        width?: number;
        height?: number;
        error?: string;
      }> = [];

      for (const path of paths) {
        try {
          const media = await uploadFileMedia(token, resolvedFile, path);
          results.push({
            path,
            id: media.id,
            mediaType: media.mtype,
            width: media.width,
            height: media.height,
          });
        } catch (err) {
          results.push({ path, error: (err as Error).message });
        }
      }

      const lines = results.map((r) => {
        if (r.error) return `- ${r.path}: ERROR — ${r.error}`;
        return `- ${r.path} → id ${r.id} (${r.mediaType}, ${r.width}×${r.height})`;
      });
      return ok(
        [
          `# Uploaded media (${results.filter((r) => r.id).length}/${results.length})`,
          '',
          'Reference these by adding `data-penpot-media-id="<id>"` to each `<img>` in the HTML.',
          '',
          ...lines,
          '',
          '```json',
          JSON.stringify(results, null, 2),
          '```',
        ].join('\n'),
      );
    },
  );
}
