import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Page, Shape } from '@penpot-tools/converter/types';
import { fetchPage, getPenpotBase, imageUrlFor } from '../penpot-api.ts';
import { requireSelection, requireToken } from '../state.ts';

const MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024;

interface AssetReference {
  shapeId: string;
  shapeName: string;
}

interface AssetEntry {
  id: string;
  name?: string;
  mediaType: string;
  width: number;
  height: number;
  url: string;
  references: AssetReference[];
}

export function collectPageAssets(page: Page): AssetEntry[] {
  const byId = new Map<string, AssetEntry>();

  const record = (
    shape: Shape,
    media: { id: string; mtype: string; width: number; height: number; name?: string },
  ): void => {
    let entry = byId.get(media.id);
    if (!entry) {
      entry = {
        id: media.id,
        name: media.name,
        mediaType: media.mtype,
        width: media.width,
        height: media.height,
        url: imageUrlFor(media.id),
        references: [],
      };
      byId.set(media.id, entry);
    } else if (!entry.name && media.name) {
      entry.name = media.name;
    }
    entry.references.push({ shapeId: shape.id, shapeName: shape.name });
  };

  for (const shape of Object.values(page.objects)) {
    if (shape.type === 'image') {
      const meta = shape.metadata;
      if (meta?.id) record(shape, meta);
    }
    if (Array.isArray(shape.fills)) {
      for (const fill of shape.fills) {
        if (fill.fillImage?.id) record(shape, fill.fillImage);
      }
    }
    if (Array.isArray(shape.strokes)) {
      for (const stroke of shape.strokes) {
        if (stroke.strokeImage?.id) record(shape, stroke.strokeImage);
      }
    }
  }

  return Array.from(byId.values());
}

const PNG_LIKE = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']);

async function fetchAssetBytes(
  token: string,
  id: string,
): Promise<{ buffer: Buffer; mimeType: string } | { errorText: string }> {
  const url = `${getPenpotBase()}/assets/by-file-media-id/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Token ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { errorText: `Penpot asset fetch failed (${res.status}): ${text || res.statusText}` };
  }
  const mimeType = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  const length = Number(res.headers.get('content-length') ?? '');
  if (Number.isFinite(length) && length > MAX_DOWNLOAD_BYTES) {
    return {
      errorText: `Asset ${id} is ${length} bytes; exceeds the ${MAX_DOWNLOAD_BYTES}-byte download cap.`,
    };
  }
  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_DOWNLOAD_BYTES) {
    return {
      errorText: `Asset ${id} is ${arrayBuffer.byteLength} bytes; exceeds the ${MAX_DOWNLOAD_BYTES}-byte download cap.`,
    };
  }
  return { buffer: Buffer.from(arrayBuffer), mimeType };
}

export function registerAssetTools(server: McpServer): void {
  server.registerTool(
    'list_assets',
    {
      title: 'List image assets used on the current Penpot page',
      description:
        'Enumerates every unique image media referenced by the current page (image shapes, fill images, stroke images). Returns id, mediaType, dimensions, the Penpot asset URL, and the shapes that reference it. Use this before "download_asset" to know which ids are available.',
      inputSchema: {
        fileId: z.string().uuid().optional(),
        pageId: z.string().uuid().optional(),
      },
    },
    async ({ fileId, pageId }) => {
      const token = await requireToken();
      let resolvedFile = fileId;
      let resolvedPage = pageId;
      if (!resolvedFile || !resolvedPage) {
        const sel = await requireSelection();
        resolvedFile ??= sel.fileId;
        resolvedPage ??= sel.pageId;
      }
      const page = await fetchPage(token, resolvedFile, resolvedPage);
      const assets = collectPageAssets(page);
      const text = [
        `# Assets — page "${page.name}" (${assets.length} unique)`,
        '',
        '```json',
        JSON.stringify(assets, null, 2),
        '```',
      ].join('\n');
      return { content: [{ type: 'text' as const, text }] };
    },
  );

  server.registerTool(
    'download_asset',
    {
      title: 'Download a Penpot image asset by id',
      description:
        'Fetches the bytes of a single image asset (the "id" returned by list_assets). Returns an inline image for png/jpeg/gif/webp, raw markup for svg, and an error for anything else. Capped at 5 MB.',
      inputSchema: {
        id: z.string().describe('The media id (from list_assets entries).'),
        fileId: z
          .string()
          .uuid()
          .optional()
          .describe('Optional file id; falls back to the viewer selection.'),
      },
    },
    async ({ id }) => {
      const token = await requireToken();
      const result = await fetchAssetBytes(token, id);
      if ('errorText' in result) {
        return {
          content: [{ type: 'text' as const, text: result.errorText }],
          isError: true,
        };
      }
      const { buffer, mimeType } = result;

      if (PNG_LIKE.has(mimeType)) {
        const normalized = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
        return {
          content: [
            {
              type: 'image' as const,
              data: buffer.toString('base64'),
              mimeType: normalized,
            },
          ],
        };
      }

      if (mimeType === 'image/svg+xml') {
        return {
          content: [{ type: 'text' as const, text: buffer.toString('utf8') }],
        };
      }

      return {
        content: [{ type: 'text' as const, text: `unsupported mime: ${mimeType || '(none)'}` }],
        isError: true,
      };
    },
  );
}
