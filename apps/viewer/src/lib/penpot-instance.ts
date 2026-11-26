export const DEFAULT_PENPOT_URL = 'https://design.penpot.app';

/**
 * Turns whatever the user typed or pasted into the instance base URL the API
 * calls are built on: `https://penpot.example.com` (or a sub-path deployment,
 * `https://example.com/penpot`). Accepts a bare host (https, or http for
 * localhost), a trailing slash, a pasted workspace link or an `/api/...` URL. Throws on anything that is not
 * an http(s) URL.
 */
export function normalizePenpotUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Penpot URL is required');
  const hasScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed);
  // Local instances rarely have TLS; anything else defaults to https.
  const isLocal = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|[^/:]+\.localhost)(:\d+)?(\/|$)/i.test(
    trimmed,
  );
  const withScheme = hasScheme ? trimmed : `${isLocal ? 'http' : 'https'}://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error(`"${trimmed}" is not a valid URL`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Penpot URL must start with http:// or https://');
  }

  const path = url.pathname.replace(/\/api(\/.*)?$/, '').replace(/\/+$/, '');
  return `${url.origin}${path}`;
}

/** Link that opens a file/page in the Penpot workspace of `baseUrl`. */
export function penpotWorkspaceUrl(
  baseUrl: string,
  { fileId, pageId, teamId }: { fileId: string; pageId: string; teamId?: string },
): string {
  const params = new URLSearchParams({ screen: 'workspace', 'file-id': fileId, 'page-id': pageId });
  if (teamId) params.set('team-id', teamId);
  return `${baseUrl}/?${params.toString()}`;
}
