import { chromium, type Browser } from 'playwright';

/**
 * Tailwind v3 preflight reset, copied from the converter's `intengration/mount.ts`.
 *
 * The converter assumes a CSS reset is in place (no default margin, border-box,
 * etc.). The viewer + integration tests both load Tailwind which provides this;
 * here we inline it so screenshots match what the user sees in `pnpm preview`
 * without depending on a CDN.
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

/**
 * Default caps in CSS px. Kept conservative because the PNG is base64-encoded
 * into the MCP response — every extra megapixel costs the model a *lot* of
 * input tokens. Callers that genuinely need the whole canvas can override.
 */
export const DEFAULT_SCREENSHOT_MAX_WIDTH = 1600;
export const DEFAULT_SCREENSHOT_MAX_HEIGHT = 2000;

export interface ScreenshotInput {
  html: string;
  fontsCss: string;
  tokensCss: string;
  background?: string;
  /** Hard cap on viewport width / height in CSS px to keep payloads bounded. */
  maxWidth?: number;
  maxHeight?: number;
}

export interface ScreenshotOutput {
  base64: string;
  width: number;
  height: number;
  /** Pixel size before clipping, when the content was larger than the cap. */
  fullWidth: number;
  fullHeight: number;
  trimmed: boolean;
}

export interface McpTextBlock {
  type: 'text';
  text: string;
}
export interface McpImageBlock {
  type: 'image';
  data: string;
  mimeType: 'image/png';
}
export type McpContentBlock = McpTextBlock | McpImageBlock;

/**
 * Two-block MCP content for an image tool result: a `caption (WxH px)` text
 * line followed by the PNG. Shared by the read-mode `get_screenshot` tool and
 * the optional `includeScreenshot` path on the write tools so they format the
 * same way.
 */
export function buildScreenshotContent(
  shot: ScreenshotOutput,
  caption: string,
): McpContentBlock[] {
  const sizeNote = shot.trimmed
    ? `${caption} (${shot.width}×${shot.height} px — trimmed from ${shot.fullWidth}×${shot.fullHeight}; pass maxWidth/maxHeight to see more)`
    : `${caption} (${shot.width}×${shot.height} px)`;
  return [
    { type: 'text', text: sizeNote },
    { type: 'image', data: shot.base64, mimeType: 'image/png' },
  ];
}

function buildDocument({ html, fontsCss, tokensCss, background }: ScreenshotInput): string {
  const bg = background ?? '#ffffff';
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
  <div id="penpot-inner">${html}</div>
</div>
</body>
</html>`;
}

/**
 * Renders a converter HTML fragment in headless chromium and returns a PNG.
 *
 * The converter emits Penpot shapes at canvas coordinates (top-level boards use
 * `transform: translate(Xpx, Ypx)`), so the content can sit far from (0, 0).
 * After loading we measure the bounding box of every visible descendant, shift
 * the inner wrapper to (0, 0), and resize the viewport to fit — this is the
 * same trick `intengration/mount.ts` uses to keep test screenshots tight.
 */
export async function renderScreenshot(input: ScreenshotInput): Promise<ScreenshotOutput> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  try {
    const page = await context.newPage();
    await page.setContent(buildDocument(input), { waitUntil: 'load' });

    await page.evaluate(async () => {
      // `@font-face` declarations don't trigger a font fetch by themselves —
      // the browser only requests the font file once layout actually needs the
      // glyphs. If we await `document.fonts.ready` BEFORE forcing a layout,
      // it resolves with no fonts in flight and we then screenshot before the
      // web font has loaded. The first render of a brand-new design then
      // shows a serif fallback while the second (post-cache) call shows the
      // correct family.
      //
      // Touch a layout-forcing property so the font requests get queued, wait
      // for them, then explicitly load every used family / weight pair as a
      // belt-and-braces in case a hidden element triggered the layout.
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

    const box = await page.evaluate(() => {
      const inner = document.getElementById('penpot-inner');
      if (!inner) return null;
      const descendants = Array.from(inner.querySelectorAll<HTMLElement>('*'));
      let minLeft = Infinity;
      let minTop = Infinity;
      let maxRight = -Infinity;
      let maxBottom = -Infinity;
      for (const el of descendants) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        minLeft = Math.min(minLeft, r.left);
        minTop = Math.min(minTop, r.top);
        maxRight = Math.max(maxRight, r.right);
        maxBottom = Math.max(maxBottom, r.bottom);
      }
      if (!Number.isFinite(minLeft)) return null;
      const cRect = inner.getBoundingClientRect();
      const dx = minLeft - cRect.left;
      const dy = minTop - cRect.top;
      inner.style.transform = `translate(${-dx}px, ${-dy}px)`;
      const width = Math.max(1, Math.ceil(maxRight - minLeft));
      const height = Math.max(1, Math.ceil(maxBottom - minTop));
      const root = document.getElementById('penpot-root');
      if (root) {
        root.style.width = `${width}px`;
        root.style.height = `${height}px`;
      }
      return { width, height };
    });

    if (!box) {
      throw new Error('Could not measure rendered content (empty bounding box).');
    }

    const maxW = Math.max(1, input.maxWidth ?? DEFAULT_SCREENSHOT_MAX_WIDTH);
    const maxH = Math.max(1, input.maxHeight ?? DEFAULT_SCREENSHOT_MAX_HEIGHT);
    const width = Math.min(box.width, maxW);
    const height = Math.min(box.height, maxH);
    const trimmed = width < box.width || height < box.height;

    await page.setViewportSize({ width, height });

    const buffer = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width, height },
      omitBackground: false,
    });

    return {
      base64: buffer.toString('base64'),
      width,
      height,
      fullWidth: box.width,
      fullHeight: box.height,
      trimmed,
    };
  } finally {
    await context.close();
  }
}
