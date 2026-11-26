import { createServerOnlyFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { buildPenpotFontsCss, type FontInfo } from '@penpot-tools/converter';
import { getPenpotBaseUrl } from '../auth';

/**
 * `@font-face` CSS whose font URLs point at the viewer's `/proxy-fonts` route
 * (see `routes/proxy-fonts.$.tsx`). The CSS itself is fetched straight from the
 * session's Penpot instance, so the server never calls its own proxy.
 */
export const buildViewerFontsCss = createServerOnlyFn(
  (fonts: readonly FontInfo[]): Promise<string> => {
    const penpotBase = getPenpotBaseUrl();
    const proxyBase = `${new URL(getRequest().url).origin}/proxy-fonts`;
    return buildPenpotFontsCss(fonts, {
      baseUrl: proxyBase,
      fetch: (input, init) => globalThis.fetch(String(input).replace(proxyBase, penpotBase), init),
    });
  },
);
