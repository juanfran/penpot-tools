import { createServerFn } from '@tanstack/react-start';
import { authMiddleware } from '../middlewares/auth.middleware';
import z from 'zod';
import { convertPage } from '@penpot-random/converter';
import { extractTokens, tokensToCss } from '@penpot-random/converter/tokens';
import type { Page, Uuid } from '@penpot-random/penpot-types';
import type { ConverterContext, FontInfo } from '@penpot-random/converter';
import { getFileSummary, rpc, rpcPick } from './penpot-api-utils.server';

const BASE_URL = 'https://design.penpot.app';

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

function buildGoogleFontsUrl(fonts: FontInfo[]): string | null {
  if (fonts.length === 0) return null;
  const byFamily = new Map<string, Array<{ weight: string; italic: boolean }>>();
  for (const font of fonts) {
    const family = font.fontFamily;
    if (!byFamily.has(family)) byFamily.set(family, []);
    byFamily.get(family)!.push({
      weight: font.fontWeight ?? '400',
      italic: font.fontStyle === 'italic',
    });
  }
  const familyParams: string[] = [];
  for (const [family, variants] of byFamily) {
    const sorted = [...variants].sort((a, b) =>
      a.italic !== b.italic ? (a.italic ? 1 : -1) : Number(a.weight) - Number(b.weight),
    );
    const tuples = sorted.map((v) => `${v.italic ? 1 : 0},${v.weight}`).join(';');
    familyParams.push(`family=${family.replace(/ /g, '+')}:ital,wght@${tuples}`);
  }
  return `https://fonts.googleapis.com/css2?${familyParams.join('&')}&display=swap`;
}

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
      googleFontsUrl: buildGoogleFontsUrl(fonts),
      tokensCss: tokensToCss(tokens),
    };
  });
