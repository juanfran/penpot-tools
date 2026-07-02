import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { authMiddleware } from '../middlewares/auth.middleware';
import { updateMcpSelection } from './mcp-state';
import z from 'zod';
import { convertPage, convertPageShapes, buildPenpotFontsCss } from '@penpot-tools/converter';
import {
  extractTokens,
  tokensToCss,
  extractAllTokens,
  type TokenInfo,
} from '@penpot-tools/converter/tokens';
import type { Page, Uuid } from '@penpot-tools/penpot-types';
import type { ConverterContext } from '@penpot-tools/converter';
import { getFileSummary, rpc, rpcTransit } from './penpot-api-utils.server';
import transit from 'transit-js';
import { extractTokenSetsFromTokensLib, type FileTokenSet } from './token-sets';

export type { FileTokenSet } from './token-sets';

const BASE_URL = 'https://design.penpot.app';

function getFontsBaseUrl(): string {
  return `${new URL(getRequest().url).origin}/proxy-fonts`;
}

export interface Team {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface PenpotFile {
  id: string;
  name: string;
  projectId: string;
  createdAt: string;
  modifiedAt: string;
  isShared: boolean;
  thumbnailId?: string;
}

export function getThumbnailUrl(thumbnailId: string): string {
  return `${BASE_URL}/assets/by-id/${thumbnailId}`;
}

export const getTeamsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return rpc<Team[]>(context.token, 'get-teams');
  });

export const getRecentFilesFn = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      teamId: z.uuid(),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    return rpc<PenpotFile[]>(context.token, 'get-team-recent-files', {
      params: { 'team-id': data.teamId },
    });
  });

export interface PenpotFileSummary {
  name: string;
  data: {
    pages: string[];
    pagesIndex: Record<string, { id: string; name: string }>;
  };
}

// export const getFileSummaryFn = createServerFn({ method: 'GET' })
//   .inputValidator(
//     z.object({
//       fileId: z.uuid(),
//     }),
//   )
//   .middleware([authMiddleware])
//   .handler(async ({ data, context }) => {
//     const result = await rpcPick<PenpotFileSummary>(
//       context.token,
//       'get-file',
//       ['data.name', 'data.pages'],
//       {
//         params: {
//           id: data.fileId,
//           features: [
//             'fdata/path-data',
//             'design-tokens/v1',
//             'variants/v1',
//             'layout/grid',
//             'styles/v2',
//             'fdata/objects-map',
//             'components/v2',
//             'fdata/shape-data-type',
//           ],
//         },
//       },
//     );

//     return result;
//   });

export const getFileSummaryFn = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      fileId: z.uuid(),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    return getFileSummary(context.token, data.fileId);
  });

export const getPageHtmlFn = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      fileId: z.uuid(),
      pageId: z.uuid(),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const page = await rpc<Page>(context.token, 'get-page', {
      params: { 'file-id': data.fileId, 'page-id': data.pageId },
    });
    const tokens = extractTokens(page.objects);
    const ctx: ConverterContext = {
      resolveImageUrl: (id: Uuid) => `${BASE_URL}/assets/by-file-media-id/${id}`,
      tokens,
      format: false,
    };
    const { html, fonts } = await convertPage(page, ctx);
    return {
      html,
      fontsCss: await buildPenpotFontsCss(fonts, { baseUrl: getFontsBaseUrl() }),
      tokensCss: tokensToCss(tokens),
    };
  });

export interface ShapeTreeNode {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: ShapeTreeNode[];
  layout?: string;
  layoutType?: string;
  layoutFlexDir?: string;
  layoutItemZIndex?: number;
  componentRoot?: boolean;
  componentId?: string;
  componentFile?: string;
  shapeRef?: string;
}

type ShapeTreeLayoutFields = {
  layout?: string;
  layoutType?: string;
  layoutFlexDir?: string;
  layoutItemZIndex?: number;
};

function buildShapeTree(objects: Page['objects'], id: string): ShapeTreeNode | null {
  const shape = objects[id];
  if (!shape) return null;
  const layoutShape = shape as ShapeTreeLayoutFields;
  const childIds: string[] =
    'shapes' in shape && Array.isArray((shape as { shapes?: unknown }).shapes)
      ? (shape as { shapes: string[] }).shapes
      : [];
  const node: ShapeTreeNode = {
    id: shape.id,
    name: shape.name,
    type: shape.type,
    x: shape.selrect.x,
    y: shape.selrect.y,
    width: shape.selrect.width,
    height: shape.selrect.height,
    children: childIds.flatMap((cid) => buildShapeTree(objects, cid) ?? []),
  };
  if (layoutShape.layout) node.layout = layoutShape.layout;
  if (layoutShape.layoutType) node.layoutType = layoutShape.layoutType;
  if (layoutShape.layoutFlexDir) node.layoutFlexDir = layoutShape.layoutFlexDir;
  if (layoutShape.layoutItemZIndex !== undefined)
    node.layoutItemZIndex = layoutShape.layoutItemZIndex;
  if (shape.componentRoot) node.componentRoot = true;
  if (shape.componentId) node.componentId = shape.componentId;
  if (shape.componentFile) node.componentFile = shape.componentFile;
  if (shape.shapeRef) node.shapeRef = shape.shapeRef;
  return node;
}

export const getPageShapesFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ fileId: z.uuid(), pageId: z.uuid() }))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const page = await rpc<Page>(context.token, 'get-page', {
      params: { 'file-id': data.fileId, 'page-id': data.pageId },
    });
    console.time(`convertPageShapes ${data.pageId}`);
    const tokens = extractTokens(page.objects);
    const ctx: ConverterContext = {
      resolveImageUrl: (id: Uuid) => `${BASE_URL}/assets/by-file-media-id/${id}`,
      tokens,
      format: false,
    };
    const { shapes, fonts } = await convertPageShapes(page, ctx);

    const root = Object.values(page.objects).find((s) => s.parentId === s.id);
    const rootChildIds: string[] =
      root && 'shapes' in root && Array.isArray((root as { shapes?: unknown }).shapes)
        ? (root as { shapes: string[] }).shapes
        : [];
    const tree = rootChildIds.flatMap((id) => buildShapeTree(page.objects, id) ?? []);

    const result = {
      name: page.name,
      shapes,
      tree,
      fontsCss: await buildPenpotFontsCss(fonts, { baseUrl: getFontsBaseUrl() }),
      tokensCss: tokensToCss(tokens),
    };

    console.timeEnd(`convertPageShapes ${data.pageId}`);
    return result;
  });

function transitGet(value: unknown, key: string): unknown {
  if (!value || typeof (value as { get?: unknown }).get !== 'function') return undefined;
  const map = value as { get: (k: unknown) => unknown };
  return (
    map.get(transit.keyword(key)) ??
    map.get(transit.keyword(key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`))) ??
    map.get(key)
  );
}

export const getFileTokenSetsFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ fileId: z.uuid() }))
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<FileTokenSet[]> => {
    try {
      const result = await rpcTransit(context.token, 'get-file', {
        params: {
          id: data.fileId,
          features: [
            'fdata/path-data',
            'design-tokens/v1',
            'variants/v1',
            'layout/grid',
            'styles/v2',
            'fdata/objects-map',
            'components/v2',
            'fdata/shape-data-type',
          ],
        },
      });

      const fileData = result.get(transit.keyword('data'));
      const tokensLib = transitGet(fileData, 'tokens-lib') ?? transitGet(fileData, 'tokensLib');
      return extractTokenSetsFromTokensLib(tokensLib).map((set) => ({
        id: set.id,
        name: set.name,
        css: set.css,
        tokenCount: set.tokenCount,
        kind: set.kind,
        active: set.active,
      }));
    } catch (err) {
      console.warn('Could not read Penpot token sets', err);
      return [];
    }
  });

export interface PageTokens {
  pageName: string;
  tokens: TokenInfo[];
}

export const getPageTokensFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ fileId: z.uuid(), pageId: z.uuid() }))
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<PageTokens> => {
    const page = await rpc<Page>(context.token, 'get-page', {
      params: { 'file-id': data.fileId, 'page-id': data.pageId },
    });
    console.time(`extractAllTokens ${data.pageId}`);
    const tokens = extractAllTokens(page.objects);
    console.timeEnd(`extractAllTokens ${data.pageId}`);
    return { pageName: page.name, tokens };
  });

export interface VariantProperty {
  name: string;
  value: string;
}

export interface LibraryComponent {
  id: string;
  name: string;
  path: string;
  variantId: string | null;
  variantProperties: VariantProperty[];
}

export interface LibraryComponents {
  fileId: string;
  components: Record<string, LibraryComponent>;
}

interface RawComponent {
  id?: string;
  name?: string;
  path?: string;
  variantId?: string;
  variantProperties?: VariantProperty[];
}

const FEATURES_FOR_COMPONENTS = [
  'fdata/path-data',
  'design-tokens/v1',
  'variants/v1',
  'layout/grid',
  'styles/v2',
  'fdata/objects-map',
  'components/v2',
  'fdata/shape-data-type',
];

interface RawFileWithComponents {
  name?: string;
  data?: { components?: Record<string, RawComponent> };
}

export const setSelectionFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      fileId: z.uuid(),
      pageId: z.uuid(),
      shapeId: z.string().optional(),
      teamId: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await updateMcpSelection(data);
  });

export const getLibraryComponentsFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ fileId: z.uuid() }))
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<LibraryComponents> => {
    let file: RawFileWithComponents;
    try {
      file = await rpc<RawFileWithComponents>(context.token, 'get-file', {
        params: {
          id: data.fileId,
          features: FEATURES_FOR_COMPONENTS,
        },
      });
    } catch (err) {
      console.log('Error fetching library components for file', data.fileId, err);

      if (err instanceof Error && err.message === 'HTTP error 404') {
        return { fileId: data.fileId, components: {} };
      }
      throw err;
    }

    const raw = file.data?.components ?? {};
    const components: Record<string, LibraryComponent> = {};
    for (const [id, comp] of Object.entries(raw)) {
      components[id] = {
        id: comp.id ?? id,
        name: comp.name ?? 'Unknown',
        path: comp.path ?? '',
        variantId: comp.variantId ?? null,
        variantProperties: comp.variantProperties ?? [],
      };
    }

    return { fileId: data.fileId, components };
  });
