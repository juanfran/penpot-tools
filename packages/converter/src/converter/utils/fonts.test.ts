import { describe, expect, it, vi } from 'vitest';
import { buildPenpotFontsCss } from './fonts';

const SAMPLE_GFONT_CSS = `@font-face {
  font-family: 'Roboto';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/roboto/v51/AAAA.woff2) format('woff2');
}`;

function mockFetch(responses: Map<string, string>): typeof globalThis.fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = responses.get(url);
    if (body === undefined) throw new Error(`Unexpected fetch: ${url}`);
    return new Response(body, { status: 200 });
  }) as unknown as typeof globalThis.fetch;
}

describe('buildPenpotFontsCss', () => {
  it('emite @font-face para sourcesanspro apuntando a /fonts/ de Penpot, sin fetch', async () => {
    const fetchFn = vi.fn();
    const css = await buildPenpotFontsCss(
      [
        { fontId: 'sourcesanspro', fontFamily: 'sourcesanspro', fontWeight: '400' },
        { fontId: 'sourcesanspro', fontFamily: 'sourcesanspro', fontWeight: '700' },
        { fontId: 'sourcesanspro', fontFamily: 'sourcesanspro', fontWeight: '700', fontStyle: 'italic' },
      ],
      { fetch: fetchFn as unknown as typeof globalThis.fetch },
    );

    expect(fetchFn).not.toHaveBeenCalled();
    expect(css).toContain('src: url(https://design.penpot.app/fonts/sourcesanspro-regular.woff2)');
    expect(css).toContain('src: url(https://design.penpot.app/fonts/sourcesanspro-bold.woff2)');
    expect(css).toContain('src: url(https://design.penpot.app/fonts/sourcesanspro-bolditalic.woff2)');
    expect(css).toContain("font-family: 'sourcesanspro'");
  });

  it('para google fonts pide la CSS a Penpot y reescribe gstatic.com → /internal/gfonts/font', async () => {
    const expectedUrl =
      'https://design.penpot.app/internal/gfonts/css?family=Roboto:regular&display=block';
    const fetchFn = mockFetch(new Map([[expectedUrl, SAMPLE_GFONT_CSS]]));

    const css = await buildPenpotFontsCss(
      [{ fontId: 'gfont-roboto', fontFamily: 'Roboto', fontWeight: '400' }],
      { fetch: fetchFn },
    );

    expect(css).not.toContain('https://fonts.gstatic.com');
    expect(css).toContain(
      'src: url(https://design.penpot.app/internal/gfonts/font/roboto/v51/AAAA.woff2)',
    );
  });

  it('agrupa variantes de la misma familia y las pasa ordenadas en una sola petición', async () => {
    const expectedUrl =
      'https://design.penpot.app/internal/gfonts/css?family=Roboto:700,700italic,italic,regular&display=block';
    const fetchFn = mockFetch(new Map([[expectedUrl, SAMPLE_GFONT_CSS]]));

    await buildPenpotFontsCss(
      [
        { fontId: 'gfont-roboto', fontFamily: 'Roboto', fontWeight: 700, fontStyle: 'italic' },
        { fontId: 'gfont-roboto', fontFamily: 'Roboto', fontWeight: 400 },
        { fontId: 'gfont-roboto', fontFamily: 'Roboto', fontWeight: 400, fontStyle: 'italic' },
        { fontId: 'gfont-roboto', fontFamily: 'Roboto', fontWeight: 700 },
      ],
      { fetch: fetchFn },
    );

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith(expectedUrl);
  });

  it('respeta un baseUrl personalizado (instancia self-hosted)', async () => {
    const expectedUrl =
      'https://penpot.example.com/internal/gfonts/css?family=Inter:regular&display=block';
    const fetchFn = mockFetch(
      new Map([
        [
          expectedUrl,
          `@font-face { src: url(https://fonts.gstatic.com/s/inter/v1/A.woff2) format('woff2'); }`,
        ],
      ]),
    );

    const css = await buildPenpotFontsCss(
      [{ fontId: 'gfont-inter', fontFamily: 'Inter' }],
      { baseUrl: 'https://penpot.example.com', fetch: fetchFn },
    );

    expect(css).toContain('https://penpot.example.com/internal/gfonts/font/inter/v1/A.woff2');
    expect(css).not.toContain('https://design.penpot.app');
  });

  it('limpia comillas y espacios extra en fontFamily', async () => {
    const expectedUrl =
      'https://design.penpot.app/internal/gfonts/css?family=Work+Sans:regular&display=block';
    const fetchFn = mockFetch(new Map([[expectedUrl, '@font-face {}']]));

    await buildPenpotFontsCss(
      [{ fontId: 'gfont-worksans', fontFamily: '  "Work   Sans"  ', fontWeight: '400' }],
      { fetch: fetchFn },
    );

    expect(fetchFn).toHaveBeenCalledWith(expectedUrl);
  });

  it('combina bundled + google fonts en la misma salida', async () => {
    const expectedUrl =
      'https://design.penpot.app/internal/gfonts/css?family=Roboto:regular&display=block';
    const fetchFn = mockFetch(new Map([[expectedUrl, SAMPLE_GFONT_CSS]]));

    const css = await buildPenpotFontsCss(
      [
        { fontId: 'sourcesanspro', fontFamily: 'sourcesanspro' },
        { fontId: 'gfont-roboto', fontFamily: 'Roboto' },
      ],
      { fetch: fetchFn },
    );

    expect(css).toContain('https://design.penpot.app/fonts/sourcesanspro-regular.woff2');
    expect(css).toContain(
      'https://design.penpot.app/internal/gfonts/font/roboto/v51/AAAA.woff2',
    );
  });
});
