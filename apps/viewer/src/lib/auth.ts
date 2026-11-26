import { createServerFn, createServerOnlyFn } from '@tanstack/react-start';
import { getRequest, setCookie } from '@tanstack/react-start/server';
import { updateMcpLogin } from './server/mcp-state';
import { DEFAULT_PENPOT_URL, normalizePenpotUrl } from './penpot-instance';

const TOKEN_COOKIE = 'penpot_token';
const BASE_URL_COOKIE = 'penpot_base_url';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const ANONYMOUS_PROFILE_ID = '00000000-0000-0000-0000-000000000000';

function readCookie(name: string): string | null {
  const cookieHeader = getRequest().headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export const getTokenFromCookie = createServerOnlyFn(() => readCookie(TOKEN_COOKIE));

/** Instance the viewer starts on before anyone picks one at login. */
function getDefaultPenpotUrl(): string {
  const fromEnv = process.env['PENPOT_BASE_URL'];
  if (!fromEnv) return DEFAULT_PENPOT_URL;
  try {
    return normalizePenpotUrl(fromEnv);
  } catch {
    console.warn(`Ignoring invalid PENPOT_BASE_URL "${fromEnv}"`);
    return DEFAULT_PENPOT_URL;
  }
}

/**
 * Base URL of the Penpot instance this browser session talks to: the one
 * chosen at login, else `PENPOT_BASE_URL`, else design.penpot.app.
 */
export const getPenpotBaseUrl = createServerOnlyFn((): string => {
  const fromCookie = readCookie(BASE_URL_COOKIE);
  if (fromCookie) {
    try {
      return normalizePenpotUrl(fromCookie);
    } catch {
      // Tampered or stale cookie: fall through to the default.
    }
  }
  return getDefaultPenpotUrl();
});

export const getPenpotBaseUrlFn = createServerFn({ method: 'GET' }).handler(() =>
  getPenpotBaseUrl(),
);

async function assertTokenWorks(baseUrl: string, token: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/main/methods/get-profile`, {
      headers: { Authorization: `Token ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error(`Could not reach a Penpot instance at ${baseUrl}`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(`${baseUrl} rejected the access token`);
  }
  if (!res.ok) {
    throw new Error(`${baseUrl} answered HTTP ${res.status}. Is this a Penpot instance?`);
  }
  const profile = (await res.json().catch(() => null)) as { id?: string } | null;
  if (!profile?.id) {
    throw new Error(`${baseUrl} does not look like a Penpot instance`);
  }
  // Penpot answers an unknown token with the anonymous profile, not a 401.
  if (profile.id === ANONYMOUS_PROFILE_ID) {
    throw new Error(`${baseUrl} rejected the access token`);
  }
}

export const saveApiKeyFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { token: string; baseUrl: string }) => ({
    token: data.token.trim(),
    baseUrl: normalizePenpotUrl(data.baseUrl),
  }))
  .handler(async ({ data }) => {
    await assertTokenWorks(data.baseUrl, data.token);
    const cookieOptions = {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
    } as const;
    // setCookie URL-encodes the value itself; readCookie decodes it once.
    setCookie(TOKEN_COOKIE, data.token, cookieOptions);
    setCookie(BASE_URL_COOKIE, data.baseUrl, cookieOptions);
    await updateMcpLogin(data.token, data.baseUrl);
  });

export const isAuthenticatedFn = createServerFn({ method: 'GET' }).handler(async () => {
  return !!getTokenFromCookie();
});
