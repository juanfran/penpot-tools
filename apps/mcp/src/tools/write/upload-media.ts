import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { uploadFileMedia } from '../../penpot-api.ts';
import { requireSelection, requireToken } from '../../state.ts';

const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });

export function registerUploadMediaTool(server: McpServer): void {
  server.registerTool(
    'upload_media',
    {
      title: 'Upload local images so they can be referenced from a Penpot design',
      description: [
        'Uploads one or more local image files to the Penpot file the user has open and',
        'returns a media id per upload. Pass these ids back to create_design_from_html /',
        'update_selection_from_html via `data-penpot-media-id="<id>"` on each `<img>` (and',
        'keep the `src` so the headless preview still renders the image). Supports png /',
        'jpg / jpeg / gif / webp / svg. Paths can be absolute or relative to the MCP cwd.',
      ].join(' '),
      inputSchema: {
        paths: z
          .array(z.string().min(1))
          .min(1)
          .describe('Local image paths (absolute or relative to the MCP cwd).'),
        fileId: z
          .string()
          .uuid()
          .optional()
          .describe('Override the destination file id; defaults to the viewer selection.'),
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
