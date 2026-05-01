import { chromium, type Browser } from 'playwright';
import type { MeasuredNode } from '../types';
import { WALKER_SOURCE } from './walk';

/**
 * Tailwind v3 preflight reset, kept in sync with `apps/mcp/src/screenshot.ts`.
 * Same baseline so HTML measured here matches what the converter assumes.
 */
const PREFLIGHT_CSS = `
*, ::before, ::after {
  box-sizing: border-box;
  border-width: 0;
  border-style: solid;
  border-color: currentColor;
}
html {
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
  -moz-tab-size: 4;
  tab-size: 4;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
  font-feature-settings: normal;
  font-variation-settings: normal;
}
body { margin: 0; line-height: inherit; background: transparent; }
hr { height: 0; color: inherit; border-top-width: 1px; }
h1, h2, h3, h4, h5, h6 { font-size: inherit; font-weight: inherit; }
a { color: inherit; text-decoration: inherit; }
b, strong { font-weight: bolder; }
blockquote, dl, dd, h1, h2, h3, h4, h5, h6, hr, figure, p, pre { margin: 0; }
fieldset { margin: 0; padding: 0; }
legend { padding: 0; }
ol, ul, menu { list-style: none; margin: 0; padding: 0; }
img, svg, video, canvas, audio, iframe, embed, object { display: block; vertical-align: middle; }
img, video { max-width: 100%; height: auto; }
[hidden] { display: none; }
`.trim();

let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
    const cleanup = () => {
      const p = browserPromise;
      browserPromise = null;
      void p?.then((b) => b.close()).catch(() => undefined);
    };
    process.once('beforeExit', cleanup);
    process.once('SIGINT', () => {
      cleanup();
      process.exit(130);
    });
    process.once('SIGTERM', () => {
      cleanup();
      process.exit(143);
    });
  }
  return browserPromise;
}

export interface MeasureInput {
  html: string;
  tokensCss?: string;
  fontsCss?: string;
  background?: string;
  maxWidth?: number;
  maxHeight?: number;
}

export interface MeasureOutput {
  nodes: MeasuredNode[];
  /** In-page warnings: silent drops the walker spotted (orphan text, ...). */
  warnings: string[];
}

/**
 * Unwrap a full HTML document into just its body contents. The LLM frequently
 * wraps a single root element in `<!DOCTYPE><html><body>…` even though the
 * tool only consumes a fragment — left as-is, the browser parser hoists those
 * tags out of `#penpot-inner` and we end up with stray nodes (or a
 * same-size duplicate frame). Strip the wrappers so the LLM's authored
 * fragment is the one and only top-level node.
 */
export function unwrapDocument(html: string): string {
  let s = html.replace(/<!DOCTYPE[^>]*>/i, '').trim();
  // Pull <body>...</body> if present.
  const body = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (body) return body[1]!.trim();
  // Pull <html>...</html> if no <body>.
  const htmlTag = s.match(/<html[^>]*>([\s\S]*?)<\/html>/i);
  if (htmlTag) return htmlTag[1]!.trim();
  return s;
}

function buildDocument({ html, tokensCss, fontsCss, background }: MeasureInput): string {
  const bg = background ?? '#ffffff';
  const inner = unwrapDocument(html);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style data-penpot-preflight>${PREFLIGHT_CSS}</style>
${tokensCss ? `<style data-penpot-tokens>${tokensCss}</style>` : ''}
${fontsCss ? `<style data-penpot-fonts>${fontsCss}</style>` : ''}
<style>
  html, body { background: ${bg}; }
  #penpot-root { position: relative; }
  #penpot-inner { position: relative; }
</style>
</head>
<body>
<div id="penpot-root">
  <div id="penpot-inner">${inner}</div>
</div>
</body>
</html>`;
}

/**
 * Renders `html` in headless Chromium, waits for fonts and images, and returns
 * a flat list of `MeasuredNode` (one per element) in document order.
 *
 * Coordinates in `node.rect` are already shifted so the bounding box of all
 * visible content sits at `(0, 0)` — the same trick the screenshot tool uses.
 */
export async function measureHtml(input: MeasureInput): Promise<MeasureOutput> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: {
      width: Math.max(1, input.maxWidth ?? 2400),
      height: Math.max(1, input.maxHeight ?? 6000),
    },
    deviceScaleFactor: 1,
  });
  try {
    const page = await context.newPage();
    await page.setContent(buildDocument(input), { waitUntil: 'load' });

    await page.evaluate(async () => {
      // See screenshot.ts for the rationale — `@font-face` is lazy, so we have
      // to force layout AND explicitly load every used family before measuring,
      // otherwise the first measurement uses a serif fallback and Penpot stores
      // the wrong text width/height.
      document.documentElement.offsetHeight;
      try {
        await document.fonts.ready;
      } catch {
        /* ignore */
      }
      const families = new Set<string>();
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
        const cs = getComputedStyle(el);
        if (!cs.fontFamily) continue;
        const family = cs.fontFamily.split(',')[0]!.trim().replace(/^['"]|['"]$/g, '');
        if (!family) continue;
        const weight = cs.fontWeight || '400';
        const style = cs.fontStyle || 'normal';
        families.add(`${style} ${weight} 1em "${family}"`);
      }
      try {
        await Promise.all([...families].map((spec) => document.fonts.load(spec)));
        await document.fonts.ready;
      } catch {
        /* ignore */
      }
      const imgs = Array.from(document.images);
      await Promise.all(
        imgs.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) return resolve();
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            }),
        ),
      );
    });

    const result = (await page.evaluate(WALKER_SOURCE)) as {
      nodes: MeasuredNode[];
      warnings?: string[];
      origin: { x: number; y: number };
    } | null;

    if (!result || result.nodes.length === 0) {
      throw new Error('measureHtml: walker returned no nodes — empty or invalid HTML?');
    }

    return { nodes: result.nodes, warnings: result.warnings ?? [] };
  } finally {
    await context.close();
  }
}
