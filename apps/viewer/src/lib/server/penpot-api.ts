import { createServerFn } from '@tanstack/react-start';
import ky from 'ky';
import { authMiddleware } from '../middlewares/auth.middleware';
import z from 'zod';
import { convertPage } from '@penpot-random/converter';
import { extractTokens, tokensToCss } from '@penpot-random/converter/tokens';
import type { Page, Uuid } from '@penpot-random/penpot-types';
import type { ConverterContext, FontInfo } from '@penpot-random/converter';

const BASE_URL = 'https://design.penpot.app';

async function rpc<T>(
  token: string,
  command: string,
  options?: { params?: Record<string, string>; body?: Record<string, unknown> },
): Promise<T> {
  return ky
    .get(`${BASE_URL}/api/rpc/command/${command}`, {
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/transit+json',
      },
      searchParams: options?.params,
      // json: options?.body ?? {},
    })
    .json<T>();
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
  id: string;
  name: string;
  data: {
    pages: string[];
    pagesIndex: Record<string, { id: string; name: string }>;
  };
}

export const getFileSummaryFn = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      fileId: z.uuid(),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    return rpc<PenpotFileSummary>(context.token, 'get-file', {
      params: { id: data.fileId },
    });
  });

export const getPageFn = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      fileId: z.uuid(),
      pageId: z.uuid(),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    return rpc<any>(context.token, 'get-page', {
      params: { 'file-id': data.fileId, 'page-id': data.pageId },
    });
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
