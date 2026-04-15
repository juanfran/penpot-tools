import { createServerFn } from '@tanstack/react-start';
import ky from 'ky';
import { authMiddleware } from '../middlewares/auth.middleware';
import z from 'zod';

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
