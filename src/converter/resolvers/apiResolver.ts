import type { Uuid } from '../../penpot.types';

/**
 * Creates a resolver that builds Penpot REST API media URLs for image assets.
 *
 * The returned function is synchronous — it constructs the URL string directly
 * without performing any network request.
 *
 * URL pattern:
 * `{apiBase}/api/rpc/command/get-file-object-thumbnails?file-id={fileId}&object-id={id}`
 */
export function createApiResolver(
  apiBase: string,
  fileId: Uuid,
  _authToken: string,
): (id: Uuid) => string {
  const base = apiBase.replace(/\/$/, '');
  return (id: Uuid): string =>
    `${base}/api/rpc/command/get-file-object-thumbnails?file-id=${fileId}&object-id=${id}`;
}
