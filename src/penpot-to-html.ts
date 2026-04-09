/**
 * CLI script: fetch a Penpot page and output its HTML.
 *
 * Usage:
 *   npx tsx src/penpot-to-html.ts --file-id <uuid> [--page-id <uuid>] [--shape-id <uuid>] [--output <path>] [--base-url <url>]
 *
 * Authentication (pick one):
 *   PENPOT_TOKEN=<access-token>          (recommended)
 *   PENPOT_EMAIL + PENPOT_PASSWORD       (username/password login)
 *
 * Optional env vars:
 *   PENPOT_BASE_URL   (default: https://design.penpot.app/api/main)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { convertPage, convertShape } from './converter/index.js';
import type { Page, Uuid } from './penpot.types.js';
import type { ConverterContext, FontInfo } from './converter/types.js';

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

interface Args {
  fileId: string;
  pageId?: string;
  shapeId?: string;
  output?: string;
  baseUrl?: string;
  cache: boolean;
}

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const fileId = get('--file-id');
  if (!fileId) {
    console.error('Error: --file-id is required');
    process.exit(1);
  }

  return {
    fileId: fileId!,
    pageId: get('--page-id'),
    shapeId: get('--shape-id'),
    output: get('--output'),
    baseUrl: get('--base-url'),
    cache: args.includes('--cache'),
  };
}

// ---------------------------------------------------------------------------
// Penpot API client
// ---------------------------------------------------------------------------

class PenpotClient {
  private headers: Record<string, string>;

  constructor(
    private readonly apiBase: string,
    token: string,
  ) {
    this.headers = {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  static async loginWithPassword(
    apiBase: string,
    email: string,
    password: string,
  ): Promise<PenpotClient> {
    const res = await fetch(`${apiBase}/login-with-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Login failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as { authToken?: string };
    const token = data.authToken;
    if (!token) {
      throw new Error('Login response did not contain an auth token');
    }
    return new PenpotClient(apiBase, token);
  }

  async getPage(fileId: string, pageId?: string): Promise<Page> {
    const params: Record<string, string> = { 'file-id': fileId };
    if (pageId) params['page-id'] = pageId;

    const url = `${this.apiBase}/methods/get-page?${new URLSearchParams(params).toString()}`;

    const res = await fetch(url, { method: 'GET', headers: this.headers });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`get-page failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<Page>;
  }
}

// ---------------------------------------------------------------------------
// Image URL resolver
// ---------------------------------------------------------------------------

function makeImageResolver(
  apiBase: string,
  token: string,
): (id: Uuid) => string {
  return (id: Uuid) =>
    `${apiBase}/methods/get-object?id=${id}&token=${encodeURIComponent(token)}`;
}

// ---------------------------------------------------------------------------
// HTML wrapper
// ---------------------------------------------------------------------------

function buildGoogleFontsUrl(fonts: FontInfo[]): string | null {
  if (fonts.length === 0) return null;

  // Group variants by font family
  const byFamily = new Map<
    string,
    Array<{ weight: string; italic: boolean }>
  >();
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
    // Sort: non-italic first, then by weight
    const sorted = [...variants].sort((a, b) =>
      a.italic !== b.italic
        ? a.italic
          ? 1
          : -1
        : Number(a.weight) - Number(b.weight),
    );
    const tuples = sorted
      .map((v) => `${v.italic ? 1 : 0},${v.weight}`)
      .join(';');
    const encoded = family.replace(/ /g, '+');
    familyParams.push(`family=${encoded}:ital,wght@${tuples}`);
  }

  return `https://fonts.googleapis.com/css2?${familyParams.join('&')}&display=swap`;
}

function wrapHtml(body: string, fonts: FontInfo[]): string {
  const googleFontsUrl = buildGoogleFontsUrl(fonts);
  const fontLink = googleFontsUrl
    ? `  <link rel="preconnect" href="https://fonts.googleapis.com" />\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n  <link rel="stylesheet" href="${googleFontsUrl}" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Penpot Export</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      background-color: #e8e9ea;
    }
  </style>
${fontLink}
</head>
<body>
${body}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

function cachePath(fileId: string): string {
  return path.join('cache', `${fileId}.json`);
}

async function loadCache(fileId: string): Promise<Page | null> {
  try {
    const raw = await fs.readFile(cachePath(fileId), 'utf8');
    return JSON.parse(raw) as Page;
  } catch {
    return null;
  }
}

async function saveCache(fileId: string, page: Page): Promise<void> {
  await fs.mkdir('cache', { recursive: true });
  await fs.writeFile(cachePath(fileId), JSON.stringify(page), 'utf8');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const {
    fileId,
    pageId,
    shapeId,
    output,
    baseUrl: cliBaseUrl,
    cache,
  } = parseArgs(process.argv);

  const apiBase =
    cliBaseUrl ??
    process.env['PENPOT_BASE_URL'] ??
    'https://design.penpot.app/api/main';

  let page: Page | null = null;

  if (cache) {
    page = await loadCache(fileId);
    if (page) {
      console.error(`Using cached file: ${cachePath(fileId)}`);
    }
  }

  let token = process.env['PENPOT_TOKEN'];

  if (!page) {
    let client: PenpotClient;

    if (token) {
      client = new PenpotClient(apiBase, token);
    } else {
      const email = process.env['PENPOT_EMAIL'];
      const password = process.env['PENPOT_PASSWORD'];
      if (!email || !password) {
        console.error(
          'Error: set PENPOT_TOKEN, or both PENPOT_EMAIL and PENPOT_PASSWORD env vars.',
        );
        process.exit(1);
      }
      client = await PenpotClient.loginWithPassword(apiBase, email, password);
      token = '';
    }

    page = await client.getPage(fileId, pageId);
    await saveCache(fileId, page);
  }

  const ctx: ConverterContext = {
    resolveImageUrl: makeImageResolver(apiBase, token ?? ''),
  };

  let body: string;
  let fonts: FontInfo[];

  if (shapeId) {
    const shape = page.objects[shapeId];
    if (!shape) {
      console.error(`Error: shape "${shapeId}" not found in page.`);
      process.exit(1);
    }
    ({ html: body, fonts } = await convertShape(shape, page.objects, ctx));
  } else {
    ({ html: body, fonts } = convertPage(page, ctx));
  }

  const html = wrapHtml(body, fonts);

  if (output) {
    await fs.writeFile(output, html, 'utf8');
    console.error(`Saved to ${output}`);
  } else {
    process.stdout.write(html);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
