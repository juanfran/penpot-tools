import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, isAbsolute, resolve as resolvePath } from 'node:path';
import type { FileChange, Page } from '@penpot-tools/converter/types';

const DEFAULT_BASE = 'https://design.penpot.app';

/**
 * Feature flags forwarded on every read/write. The Penpot backend uses these
 * to decide whether to flatten objects-maps / pointer-maps server-side and to
 * accept design-tokens / variants / components-v2 payloads. Mirrors what the
 * converter sends.
 */
const PENPOT_FEATURES = [
  'design-tokens/v1',
  'variants/v1',
  'components/v2',
  'styles/v2',
  'fdata/objects-map',
  'fdata/path-data',
  'fdata/shape-data-type',
  'layout/grid',
  'plugins/runtime',
];

export function getPenpotBase(): string {
  return process.env['PENPOT_BASE_URL'] ?? DEFAULT_BASE;
}

function rpcUrl(method: string): string {
  return `${getPenpotBase()}/api/rpc/command/${method}`;
}

async function rpcJson<T>(token: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(rpcUrl(method), {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Penpot ${method} failed (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
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

interface FileMetaResponse {
  id: string;
  revn: number;
  vern?: number;
}

export interface FileMeta {
  id: string;
  revn: number;
  vern: number;
}

/**
 * Lightweight read of `revn`/`vern` for optimistic concurrency. Penpot's
 * `get-file` returns the entire file payload; we only need the metadata fields.
 *
 * `vern` is required on `update-file` requests alongside `revn` — it's a
 * companion revision number Penpot bumps for non-content changes (e.g. version
 * pins). Defaults to 0 for files that have never been versioned.
 */
export async function getFileMeta(token: string, fileId: string): Promise<FileMeta> {
  const data = await rpcJson<FileMetaResponse>(token, 'get-file', {
    id: fileId,
    features: PENPOT_FEATURES,
  });
  return { id: data.id, revn: data.revn, vern: data.vern ?? 0 };
}

export interface UpdateFileResult {
  /** New revision number after applying the changes. */
  revn: number;
}

export class PenpotConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PenpotConflictError';
  }
}

/**
 * Apply a list of `FileChange`s atomically. Penpot's optimistic concurrency
 * rejects with HTTP 409 when `revn` is stale — we surface that as a typed
 * error so the MCP tool can fail fast (per the v1 plan).
 */
export async function updateFile(
  token: string,
  fileId: string,
  revn: number,
  vern: number,
  changes: FileChange[],
  sessionId?: string,
): Promise<UpdateFileResult> {
  const body = {
    id: fileId,
    revn,
    vern,
    sessionId: sessionId ?? randomUUID(),
    features: PENPOT_FEATURES,
    changes,
  };
  const res = await fetch(rpcUrl('update-file'), {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    const text = await res.text().catch(() => '');
    throw new PenpotConflictError(
      `Penpot update-file conflict (revn ${revn} stale). Reload the selection and retry. ${text}`,
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Penpot update-file failed (${res.status}): ${text}`);
  }
  return (await res.json()) as UpdateFileResult;
}

export interface UploadedMedia {
  id: string;
  name: string;
  mtype: string;
  width: number;
  height: number;
}

const SUPPORTED_MIME = new Map<string, string>([
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['gif', 'image/gif'],
  ['webp', 'image/webp'],
  ['svg', 'image/svg+xml'],
]);

function mimeFromPath(path: string): string {
  const ext = path.toLowerCase().split('.').pop() ?? '';
  return SUPPORTED_MIME.get(ext) ?? 'application/octet-stream';
}

/**
 * Upload a local image so it can be referenced as a Penpot media asset. The
 * returned `id` is the same UUID the converter would emit as
 * `metadata.id` / `fillImage.id`.
 *
 * Resolves relative paths against the MCP process cwd. Refuses non-image MIME
 * types up front to avoid wasting an upload round-trip.
 */
export async function uploadFileMedia(
  token: string,
  fileId: string,
  inputPath: string,
): Promise<UploadedMedia> {
  const absolute = isAbsolute(inputPath) ? inputPath : resolvePath(process.cwd(), inputPath);
  const info = await stat(absolute);
  if (!info.isFile()) {
    throw new Error(`upload_media: path is not a regular file: ${absolute}`);
  }
  const buf = await readFile(absolute);
  const mtype = mimeFromPath(absolute);
  if (!mtype.startsWith('image/')) {
    throw new Error(`upload_media: unsupported file type for ${absolute} (${mtype})`);
  }

  const form = new FormData();
  form.set('file-id', fileId);
  form.set('name', basename(absolute));
  form.set('is-local', 'true');
  form.set('content', new Blob([new Uint8Array(buf)], { type: mtype }), basename(absolute));

  const res = await fetch(rpcUrl('upload-file-media-object'), {
    method: 'POST',
    headers: { Authorization: `Token ${token}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Penpot upload-file-media-object failed (${res.status}): ${text}`);
  }
  return (await res.json()) as UploadedMedia;
}
