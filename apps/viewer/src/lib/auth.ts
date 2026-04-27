import { createServerFn, createServerOnlyFn } from '@tanstack/react-start';
import { getRequest, setCookie } from '@tanstack/react-start/server';
import { updateMcpToken } from './server/mcp-state';

const COOKIE_NAME = 'penpot_token';

export const getTokenFromCookie = createServerOnlyFn(() => {
  const cookieHeader = getRequest().headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
});

export const saveApiKeyFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    setCookie(COOKIE_NAME, encodeURIComponent(data.token), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    await updateMcpToken(data.token);
  });

export const isAuthenticatedFn = createServerFn({ method: 'GET' }).handler(async () => {
  return !!getTokenFromCookie();
});
