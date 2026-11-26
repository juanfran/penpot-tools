import { createFileRoute } from '@tanstack/react-router';
import { getPenpotBaseUrl } from '#/lib/auth';

// Only Penpot's public font endpoints; anything else is not ours to proxy.
const ALLOWED_PREFIXES = ['fonts/', 'internal/gfonts/'];
const FORWARDED_HEADERS = ['content-type', 'cache-control', 'etag', 'last-modified'];

/**
 * Serves the fonts referenced by the rendered HTML from the viewer's own
 * origin, forwarding to the Penpot instance this session is logged into.
 */
export const Route = createFileRoute('/proxy-fonts/$')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const path = params._splat ?? '';
        if (path.includes('..') || !ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
          return new Response('Not found', { status: 404 });
        }

        const target = `${getPenpotBaseUrl()}/${path}${new URL(request.url).search}`;
        const upstream = await fetch(target);
        const headers = new Headers();
        for (const name of FORWARDED_HEADERS) {
          const value = upstream.headers.get(name);
          if (value) headers.set(name, value);
        }
        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});
