import { createServerFn } from '@tanstack/react-start';
import { getRequest, setCookie } from '@tanstack/react-start/server';

const COOKIE_NAME = 'penpot_token';

export function getTokenFromCookie(): string | null {
  const cookieHeader = getRequest().headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export const saveApiKeyFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    setCookie(COOKIE_NAME, encodeURIComponent(data.token), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });
  });

export const isAuthenticatedFn = createServerFn({ method: 'GET' }).handler(async () => {
  return !!getTokenFromCookie();
});
