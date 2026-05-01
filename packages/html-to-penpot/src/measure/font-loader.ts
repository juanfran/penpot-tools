/**
 * Auto-resolve `font-family` declarations the LLM author wrote (e.g.
 * `font-family: 'Inter'`) into a real `@font-face` block before headless
 * Chromium measures the page. Without this, Chromium falls back to its
 * built-in serif/sans and Penpot stores text geometry computed against the
 * wrong glyph metrics — the canonical symptom is text that wraps a single
 * character to a second line because the box was sized to a wider fallback.
 *
 * Strategy: scan the inline `style="..."` attributes for `font-family`,
 * fetch the Google Fonts CSS endpoint for the unique families found, and
 * inject the response as a `<style>` block. Failures (offline, rate limit,
 * unknown family) are swallowed — the renderer still produces output, just
 * with the previous fallback metrics. A warning surfaces the families we
 * could not resolve so the LLM can investigate.
 */

const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
]);

const STYLE_ATTR_RE = /\bstyle\s*=\s*("([^"]*)"|'([^']*)')/gi;

function firstFamilyFromValue(value: string): string | null {
  const first = value.split(',')[0]!;
  // Strip leading/trailing whitespace + surrounding ' or " around the family.
  const trimmed = first.trim().replace(/^['"]|['"]$/g, '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('var(')) return null;
  if (GENERIC_FAMILIES.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

/**
 * Extract the first non-generic family from every `font-family` declaration
 * found in inline `style="..."` (or `'...'`) attributes. Iterating
 * style-attribute by style-attribute keeps the parser robust against
 * arbitrary HTML — the previous shape-of-regex tripped over quoted family
 * names because the quote characters were also used as the attribute
 * delimiter.
 */
export function detectFontFamilies(html: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  STYLE_ATTR_RE.lastIndex = 0;
  while ((m = STYLE_ATTR_RE.exec(html))) {
    const styleStr = m[2] ?? m[3] ?? '';
    for (const decl of styleStr.split(';')) {
      const idx = decl.indexOf(':');
      if (idx < 0) continue;
      const prop = decl.slice(0, idx).trim().toLowerCase();
      if (prop !== 'font-family') continue;
      const value = decl.slice(idx + 1);
      const family = firstFamilyFromValue(value);
      if (!family) continue;
      if (seen.has(family)) continue;
      seen.add(family);
      out.push(family);
    }
  }
  return out;
}

/**
 * The full Google Fonts weight axis. Asking for every weight for every family
 * keeps the request small (~1 HTTP call) and means an LLM can use 200..900
 * without us having to second-guess what the document actually uses.
 */
const ALL_WEIGHTS = '100;200;300;400;500;600;700;800;900';
const ALL_ITALIC_WEIGHTS = `0,${ALL_WEIGHTS};1,${ALL_WEIGHTS}`;

function buildGoogleFontsUrl(families: readonly string[]): string {
  const params = families
    .map(
      (f) =>
        `family=${encodeURIComponent(f).replace(/%20/g, '+')}:ital,wght@${ALL_ITALIC_WEIGHTS}`,
    )
    .join('&');
  return `https://fonts.googleapis.com/css2?${params}&display=block`;
}

/**
 * Default UA — Google Fonts serves a stub CSS without `@font-face` if the
 * caller's UA looks too old; pretending to be a recent Chrome unlocks the
 * woff2 URLs every browser actually wants.
 */
const DEFAULT_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export interface FetchOptions {
  fetch?: typeof globalThis.fetch;
  /** Abort the fetch after this many ms. Default 5000. */
  timeoutMs?: number;
  /** Override the User-Agent header (test hook). */
  userAgent?: string;
}

export async function fetchGoogleFontsCss(
  families: readonly string[],
  opts: FetchOptions = {},
): Promise<string> {
  if (families.length === 0) return '';
  const fetchFn = opts.fetch ?? globalThis.fetch;
  const timeoutMs = opts.timeoutMs ?? 5000;
  const ua = opts.userAgent ?? DEFAULT_UA;
  const url = buildGoogleFontsUrl(families);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      headers: { 'User-Agent': ua },
      signal: controller.signal,
    });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

const CACHE = new Map<string, Promise<string>>();

/**
 * Resolve every non-generic `font-family` referenced in `html` to a
 * `@font-face` block via Google Fonts, returning a string suitable for
 * dropping into `<style>...</style>` ahead of measurement.
 *
 * Results are cached by the sorted family list so repeated calls within the
 * process (typical when an LLM iterates on the same design) don't re-hit the
 * network.
 */
export async function autoFontsCssFor(
  html: string,
  opts: FetchOptions = {},
): Promise<{ css: string; families: string[]; resolved: boolean }> {
  const families = detectFontFamilies(html).sort();
  if (families.length === 0) {
    return { css: '', families: [], resolved: true };
  }
  const key = families.join('|');
  let p = CACHE.get(key);
  if (!p) {
    p = fetchGoogleFontsCss(families, opts);
    CACHE.set(key, p);
  }
  const css = await p;
  return { css, families, resolved: css.length > 0 };
}

/** Test hook — clears the in-process cache so a test can re-run a fetch. */
export function _clearAutoFontsCache(): void {
  CACHE.clear();
}
