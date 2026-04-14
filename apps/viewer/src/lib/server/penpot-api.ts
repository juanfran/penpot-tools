import { createServerFn } from '@tanstack/react-start';
import ky from 'ky';

const BASE_URL = 'https://design.penpot.app';

async function rpc<T>(
  token: string,
  command: string,
  options?: { params?: Record<string, string>; body?: Record<string, unknown> },
): Promise<T> {
  return ky
    .post(`${BASE_URL}/api/rpc/command/${command}`, {
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/transit+json',
      },
      searchParams: options?.params,
      json: options?.body ?? {},
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
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    return rpc<Team[]>(data.token, 'get-teams');
  });

export const getRecentFilesFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { token: string; teamId: string }) => data)
  .handler(async ({ data }) => {
    const result = await rpc<PenpotFile[]>(data.token, 'get-team-recent-files', {
      params: { 'team-id': data.teamId },
    });

    return result;
  });
