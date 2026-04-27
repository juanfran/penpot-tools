import type { Page } from '@penpot-random/converter/types';

const DEFAULT_BASE = 'https://design.penpot.app';

export function getPenpotBase(): string {
  return process.env['PENPOT_BASE_URL'] ?? DEFAULT_BASE;
}

export async function fetchPage(token: string, fileId: string, pageId: string): Promise<Page> {
  const base = getPenpotBase();
  const url = `${base}/api/main/methods/get-page?file-id=${encodeURIComponent(fileId)}&page-id=${encodeURIComponent(pageId)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Token ${token}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Penpot get-page failed (${res.status}): ${text}`);
  }
  return (await res.json()) as Page;
}

export function imageUrlFor(id: string): string {
  return `${getPenpotBase()}/assets/by-file-media-id/${id}`;
}
