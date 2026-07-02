import { redirect } from '@tanstack/react-router';
import { createServerOnlyFn } from '@tanstack/react-start';
import { Readable } from 'node:stream';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/pick.js';
import { streamValues } from 'stream-json/streamers/stream-values.js';
import transit from 'transit-js';
import { extractTokenSetsFromTokensLib, type FileTokenSet } from './token-sets';

const reader = transit.reader('json');

const BASE_URL = 'https://design.penpot.app';

export async function rpc<T>(
  token: string,
  command: string,
  options?: { params?: Record<string, string | string[]> },
): Promise<T> {
  let searchParams: URLSearchParams | undefined;
  if (options?.params) {
    searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (Array.isArray(value)) {
        for (const v of value) searchParams.append(key, v);
      } else {
        searchParams.set(key, value);
      }
    }
  }
  const url = new URL(`${BASE_URL}/api/main/methods/${command}`);
  if (searchParams) {
    url.search = searchParams.toString();
  }

  const id = crypto.randomUUID();
  console.time(`RPC ${command} (${id})`);
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Token ${token}`,
      Accept: 'application/json',
    },
  });
  console.timeEnd(`RPC ${command} (${id})`);

  if (response.status === 401) {
    throw redirect({ to: '/login' });
  }

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }

  console.time(`Parse response ${command} (${id})`);
  const result = (await response.json()) as Promise<T>;
  console.timeEnd(`Parse response ${command} (${id})`);

  return result;
}

function createPickFilter(
  filters: string | string[],
): (stack: (string | number | null)[], chunk: any) => boolean {
  const filterList = Array.isArray(filters) ? filters : [filters];
  const filterPaths = filterList.map((f) => f.split('.'));

  return (stack: (string | number | null)[]): boolean => {
    for (const filterPath of filterPaths) {
      if (stack.length === filterPath.length) {
        if (stack.every((s, i) => s === filterPath[i])) {
          return true;
        }
      }

      if (stack.length < filterPath.length) {
        if (stack.every((s, i) => s === filterPath[i])) {
          return true;
        }
      }
    }
    return false;
  };
}

export async function rpcPick<T>(
  token: string,
  command: string,
  filter: string | string[],
  options?: { params?: Record<string, string | string[]> },
): Promise<T> {
  let searchParams: URLSearchParams | undefined;
  if (options?.params) {
    searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (Array.isArray(value)) {
        for (const v of value) searchParams.append(key, v);
      } else {
        searchParams.set(key, value);
      }
    }
  }
  const url = new URL(`${BASE_URL}/api/main/methods/${command}`);
  if (searchParams) {
    url.search = searchParams.toString();
  }

  const id = crypto.randomUUID();
  console.time(`RPC Pick ${command} (${id})`);
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Token ${token}`,
      Accept: 'application/json',
    },
  });
  console.timeEnd(`RPC Pick ${command} (${id})`);

  if (response.status === 401) {
    throw redirect({ to: '/login' });
  }

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }

  const source = Readable.fromWeb(response.body as any);

  console.time(`Parse and pick response ${command} (${id})`);

  return await new Promise((resolve, reject) => {
    let done = false;

    const filterFn = createPickFilter(filter);
    const pipeline = chain([source, parser(), pick({ filter: filterFn }), streamValues()]);

    pipeline.on('data', ({ value }) => {
      if (done) {
        return;
      }

      done = true;

      console.timeEnd(`Parse and pick response ${command} (${id})`);
      resolve(value);

      pipeline.destroy();
      source.destroy();
    });

    pipeline.on('error', (error) => {
      if (!done) {
        done = true;
        reject(error);
      }
    });

    pipeline.on('end', () => {
      if (!done) {
        done = true;
        const filterStr = Array.isArray(filter) ? filter.join(', ') : filter;
        reject(new Error(`Path not found: ${filterStr}`));
      }
    });
  });
}

export const rpcTransit = createServerOnlyFn(
  async (
    token: string,
    command: string,
    options?: { params?: Record<string, string | string[]> },
  ): Promise<transit.TransitMap> => {
    let searchParams: URLSearchParams | undefined;
    if (options?.params) {
      searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(options.params)) {
        if (Array.isArray(value)) {
          for (const v of value) searchParams.append(key, v);
        } else {
          searchParams.set(key, value);
        }
      }
    }
    const url = new URL(`${BASE_URL}/api/main/methods/${command}`);
    if (searchParams) {
      url.search = searchParams.toString();
    }

    const id = crypto.randomUUID();
    console.time(`RPC ${command} (${id})`);
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/transit+json',
        Accept: 'application/transit+json',
      },
    });
    console.timeEnd(`RPC ${command} (${id})`);

    if (response.status === 401) {
      throw redirect({ to: '/login' });
    }

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    console.time(`Parse response ${command} (${id})`);
    const result = reader.read(await response.text()) as transit.TransitMap;
    console.timeEnd(`Parse response ${command} (${id})`);

    return result;
  },
);

export interface FileSummary {
  name: string;
  data: {
    pages: string[];
    pagesIndex: Record<string, { id: string; name: string }>;
  };
  tokenSets: FileTokenSet[];
}

export const getFileSummary = createServerOnlyFn(
  async (token: string, fileId: string): Promise<FileSummary> => {
    const result = await rpcTransit(token, 'get-file', {
      params: {
        id: fileId,
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
    const pages = fileData?.get<unknown[]>(transit.keyword('pages'));
    const pagesIndex = fileData?.get(transit.keyword('pages-index'));
    const tokensLib =
      fileData?.get(transit.keyword('tokens-lib')) ?? fileData?.get(transit.keyword('tokensLib'));
    let tokenSets: FileTokenSet[] = [];

    try {
      tokenSets = extractTokenSetsFromTokensLib(tokensLib).map((set) => ({
        id: set.id,
        name: set.name,
        css: set.css,
        tokenCount: set.tokenCount,
        kind: set.kind,
        active: set.active,
      }));
    } catch (err) {
      console.warn('Could not read Penpot token sets', err);
    }

    return {
      name: result.get<string>(transit.keyword('name')) ?? '',
      data: {
        pages: pages?.map((p) => String(p)) ?? [],
        pagesIndex: pagesIndex
          ? Object.fromEntries(
              [...pagesIndex.keys()].map((key) => {
                const entry = pagesIndex.get(key);
                return [
                  String(key),
                  {
                    id: String(entry?.get<unknown>(transit.keyword('id')) ?? ''),
                    name: entry?.get<string>(transit.keyword('name')) ?? '',
                  },
                ];
              }),
            )
          : {},
      },
      tokenSets,
    };
  },
);
