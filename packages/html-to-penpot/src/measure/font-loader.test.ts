import { afterEach, describe, expect, it } from 'vitest';
import {
  _clearAutoFontsCache,
  autoFontsCssFor,
  detectFontFamilies,
  fetchGoogleFontsCss,
} from './font-loader';

describe('detectFontFamilies', () => {
  it('extracts the first non-generic family from inline styles', () => {
    const html = `<div style="font-family: 'Inter', sans-serif">a</div>
                  <span style='font-family: "Source Sans Pro", system-ui'>b</span>`;
    expect(detectFontFamilies(html)).toEqual(['Inter', 'Source Sans Pro']);
  });

  it('skips generic families and var(...) references', () => {
    const html = `<div style="font-family: serif">x</div>
                  <div style="font-family: var(--brand-font, sans-serif)">y</div>
                  <div style="font-family: monospace">z</div>`;
    expect(detectFontFamilies(html)).toEqual([]);
  });

  it('dedupes across many declarations', () => {
    const html = `
      <div style="font-family: Inter">a</div>
      <div style="font-family: 'Inter', sans-serif">b</div>
      <div style="font-family: Inter; color: red">c</div>
    `;
    expect(detectFontFamilies(html)).toEqual(['Inter']);
  });

  it('returns an empty list for HTML with no font declarations', () => {
    expect(detectFontFamilies('<div>plain</div>')).toEqual([]);
  });

  it('handles multi-word family names with spaces preserved', () => {
    const html = `<p style="font-family: 'Source Sans 3', sans-serif">x</p>`;
    expect(detectFontFamilies(html)).toEqual(['Source Sans 3']);
  });
});

describe('fetchGoogleFontsCss (mocked fetch)', () => {
  it('builds the right URL and returns the body when fetch succeeds', async () => {
    let calledUrl = '';
    const fakeFetch: typeof fetch = (input) => {
      calledUrl = String(input);
      return Promise.resolve(
        new Response(`@font-face { font-family: 'Inter'; src: url(...) }`, { status: 200 }),
      );
    };
    const css = await fetchGoogleFontsCss(['Inter'], { fetch: fakeFetch });
    expect(css).toContain('@font-face');
    expect(calledUrl).toContain('https://fonts.googleapis.com/css2');
    expect(calledUrl).toContain('family=Inter');
    expect(calledUrl).toContain('display=block');
  });

  it('encodes spaces in family names as +', async () => {
    let calledUrl = '';
    const fakeFetch: typeof fetch = (input) => {
      calledUrl = String(input);
      return Promise.resolve(new Response('', { status: 200 }));
    };
    await fetchGoogleFontsCss(['Source Sans 3'], { fetch: fakeFetch });
    expect(calledUrl).toContain('family=Source+Sans+3');
  });

  it('returns empty string on a non-OK response', async () => {
    const fakeFetch: typeof fetch = () =>
      Promise.resolve(new Response('not found', { status: 404 }));
    const css = await fetchGoogleFontsCss(['Nope'], { fetch: fakeFetch });
    expect(css).toBe('');
  });

  it('returns empty string when fetch throws', async () => {
    const fakeFetch: typeof fetch = () => Promise.reject(new Error('offline'));
    const css = await fetchGoogleFontsCss(['Inter'], { fetch: fakeFetch });
    expect(css).toBe('');
  });

  it('returns empty string for an empty family list without calling fetch', async () => {
    let called = false;
    const fakeFetch: typeof fetch = () => {
      called = true;
      return Promise.resolve(new Response('', { status: 200 }));
    };
    const css = await fetchGoogleFontsCss([], { fetch: fakeFetch });
    expect(css).toBe('');
    expect(called).toBe(false);
  });
});

describe('autoFontsCssFor', () => {
  afterEach(() => _clearAutoFontsCache());

  it('returns css + families when fonts are detected', async () => {
    const fakeFetch: typeof fetch = () =>
      Promise.resolve(new Response('@font-face{}', { status: 200 }));
    const result = await autoFontsCssFor(`<div style="font-family: Inter">x</div>`, {
      fetch: fakeFetch,
    });
    expect(result.families).toEqual(['Inter']);
    expect(result.resolved).toBe(true);
    expect(result.css).toContain('@font-face');
  });

  it('flags resolved=false when families exist but fetch returns empty', async () => {
    const fakeFetch: typeof fetch = () => Promise.resolve(new Response('', { status: 500 }));
    const result = await autoFontsCssFor(`<div style="font-family: Whatever">x</div>`, {
      fetch: fakeFetch,
    });
    expect(result.families).toEqual(['Whatever']);
    expect(result.resolved).toBe(false);
    expect(result.css).toBe('');
  });

  it('reuses the cache for the same family list', async () => {
    let calls = 0;
    const fakeFetch: typeof fetch = () => {
      calls++;
      return Promise.resolve(new Response('@font-face{}', { status: 200 }));
    };
    const html = `<div style="font-family: Inter">x</div>`;
    await autoFontsCssFor(html, { fetch: fakeFetch });
    await autoFontsCssFor(html, { fetch: fakeFetch });
    expect(calls).toBe(1);
  });
});
