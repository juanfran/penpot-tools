import { constants } from 'node:fs';
import { lstat, mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
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

// Headless Chromium hints fonts by default, which rounds every glyph advance to
// a whole pixel. Penpot lays text out with fractional advances, so a line that
// fits its box in Penpot (e.g. 291.1px in 294px) measures 298px here and wraps.
// Disabling hinting keeps advances fractional and line breaks match Penpot.
export const CHROMIUM_ARGS = ['--font-render-hinting=none'];

let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true, args: CHROMIUM_ARGS });
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

/** Largest side, in device pixels, of a `fullSize` render (PNG/Skia limit). */
export const MAX_EXPORT_SIDE_PX = 32767;
/** Largest area, in device pixels, of a `fullSize` render (~256 MB as RGBA). */
export const MAX_EXPORT_PIXELS = 64_000_000;

export interface ScreenshotInput {
  html: string;
  fontsCss: string;
  tokensCss: string;
  background?: string;
  /** Hard cap on viewport width / height in CSS px to keep payloads bounded. */
  maxWidth?: number;
  maxHeight?: number;
  /** Device pixels per CSS px. Default 1, so the PNG has the design's size. */
  scale?: number;
  /** Render the whole content and ignore maxWidth/maxHeight. */
  fullSize?: boolean;
}

export interface ScreenshotOutput {
  base64: string;
  width: number;
  height: number;
  /** Pixel size before clipping, when the content was larger than the cap. */
  fullWidth: number;
  fullHeight: number;
  trimmed: boolean;
  /** Device pixels per CSS px. */
  scale: number;
  /** Real size of the PNG, read from its header. */
  pixelWidth: number;
  pixelHeight: number;
}

export interface OutputPathOptions {
  /** Replace an existing regular file. Symbolic links are always refused. */
  overwrite?: boolean;
}

/**
 * Check that `outputPath` can take a PNG: absolute, ending in `.png`, not a
 * symbolic link, not a folder, and not an existing file unless `overwrite`.
 * Call it before rendering so a bad path fails fast. Returns the resolved path.
 */
export async function prepareOutputPath(
  outputPath: string,
  { overwrite = false }: OutputPathOptions = {},
): Promise<string> {
  if (!isAbsolute(outputPath)) {
    throw new Error(`outputPath must be an absolute path, got "${outputPath}".`);
  }
  if (!/\.png$/i.test(outputPath)) {
    throw new Error(`outputPath must end in .png, got "${outputPath}".`);
  }
  const target = resolve(outputPath);
  const stat = await lstat(target).catch((err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') return null;
    throw err;
  });
  if (stat?.isSymbolicLink()) {
    throw new Error(`outputPath "${target}" is a symbolic link; refusing to write through it.`);
  }
  if (stat && !stat.isFile()) {
    throw new Error(`outputPath "${target}" exists and is not a regular file.`);
  }
  if (stat && !overwrite) {
    throw new Error(`outputPath "${target}" already exists; pass overwrite:true to replace it.`);
  }
  return target;
}

/**
 * Write a rendered PNG to `outputPath`, creating missing folders. Refuses
 * symbolic links, and existing files unless `overwrite` is set.
 */
export async function saveScreenshot(
  shot: ScreenshotOutput,
  outputPath: string,
  options: OutputPathOptions = {},
): Promise<{ path: string; bytes: number }> {
  const target = await prepareOutputPath(outputPath, options);
  const data = Buffer.from(shot.base64, 'base64');
  await mkdir(dirname(target), { recursive: true });
  // O_NOFOLLOW / O_EXCL close the gap between the check above and the write.
  const flags =
    constants.O_WRONLY |
    constants.O_CREAT |
    (constants.O_NOFOLLOW ?? 0) |
    (options.overwrite ? constants.O_TRUNC : constants.O_EXCL);
  try {
    await writeFile(target, data, { flag: flags });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EEXIST') {
      throw new Error(`outputPath "${target}" already exists; pass overwrite:true to replace it.`);
    }
    if (code === 'ELOOP') {
      throw new Error(`outputPath "${target}" is a symbolic link; refusing to write through it.`);
    }
    throw err;
  }
  return { path: target, bytes: data.length };
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
export function buildScreenshotContent(shot: ScreenshotOutput, caption: string): McpContentBlock[] {
  const sizeNote = shot.trimmed
    ? `${caption} (${shot.width}×${shot.height} px — trimmed from ${shot.fullWidth}×${shot.fullHeight}; pass maxWidth/maxHeight to see more, or call get_screenshot with outputPath for the full-size PNG)`
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
 * In-page script that measures the painted box of `#penpot-inner`, shifts the
 * content to (0, 0) and sizes `#penpot-root` to fit. Returns `{ width, height }`
 * in CSS px, or null when nothing is painted.
 *
 * - Content clipped by an `overflow` ancestor (a board with clip content) does
 *   not grow the box, so a board exports at its own size.
 * - Outer box-shadows grow the box, as they do in a Penpot export.
 *
 * Plain JS in a string on purpose: the MCP runs through tsx, whose esbuild
 * transform wraps named functions in `__name(...)`, a helper that does not
 * exist in the page. Same approach as html-to-penpot's `WALKER_SOURCE`.
 */
const MEASURE_SOURCE = `(() => {
  const inner = document.getElementById('penpot-inner');
  if (!inner) return null;
  const intersect = (a, c) => {
    const out = {
      l: Math.max(a.l, c.l),
      t: Math.max(a.t, c.t),
      r: Math.min(a.r, c.r),
      b: Math.min(a.b, c.b),
    };
    return out.r > out.l && out.b > out.t ? out : null;
  };
  // Computed value: "rgba(...) Xpx Ypx Blurpx Spreadpx [inset], ...".
  const outerShadows = (value) =>
    value === 'none'
      ? []
      : value
          .split(/,(?![^(]*\\))/)
          .filter((part) => !/\\binset\\b/.test(part))
          .map((part) => (part.match(/-?[\\d.]+px/g) || []).map(parseFloat))
          .map((n) => ({ x: n[0] || 0, y: n[1] || 0, reach: (n[2] || 0) + (n[3] || 0) }));
  // Largest stretch of a 2D matrix, so offsets grow with a scaled element.
  const matrixScale = (value) => {
    const m = /matrix\\(([^)]+)\\)/.exec(value);
    if (!m) return 1;
    const [a, b, c, d] = m[1].split(',').map(parseFloat);
    return Math.max(Math.hypot(a, b), Math.hypot(c, d)) || 1;
  };
  // A layer blur bleeds about three times its radius.
  const blurBleed = (value) => {
    const m = /blur\\(([\\d.]+)px\\)/.exec(value);
    return m ? 3 * parseFloat(m[1]) : 0;
  };
  let total = null;
  const add = (bx) => {
    total = total
      ? {
          l: Math.min(total.l, bx.l),
          t: Math.min(total.t, bx.t),
          r: Math.max(total.r, bx.r),
          b: Math.max(total.b, bx.b),
        }
      : bx;
  };
  // Walk the tree, carrying the clip of every overflow ancestor and whether
  // a transform is in effect: under a transform a shadow offset turns with
  // the element, so it is applied on every side.
  const walk = (el, clip, transformed) => {
    for (const child of Array.from(el.children)) {
      const cs = getComputedStyle(child);
      if (cs.display === 'none') continue;
      const ownTransform = cs.transform !== 'none';
      const turned = transformed || ownTransform;
      const k = ownTransform ? matrixScale(cs.transform) : 1;
      const r = child.getBoundingClientRect();
      const own = { l: r.left, t: r.top, r: r.right, b: r.bottom };
      const painted = { l: own.l, t: own.t, r: own.r, b: own.b };
      for (const sh of outerShadows(cs.boxShadow)) {
        if (turned) {
          const pad = (Math.abs(sh.x) + Math.abs(sh.y) + sh.reach) * k;
          painted.l = Math.min(painted.l, own.l - pad);
          painted.t = Math.min(painted.t, own.t - pad);
          painted.r = Math.max(painted.r, own.r + pad);
          painted.b = Math.max(painted.b, own.b + pad);
        } else {
          painted.l = Math.min(painted.l, own.l + sh.x - sh.reach);
          painted.t = Math.min(painted.t, own.t + sh.y - sh.reach);
          painted.r = Math.max(painted.r, own.r + sh.x + sh.reach);
          painted.b = Math.max(painted.b, own.b + sh.y + sh.reach);
        }
      }
      const bleed = r.width > 0 || r.height > 0 ? blurBleed(cs.filter) * k : 0;
      painted.l -= bleed;
      painted.t -= bleed;
      painted.r += bleed;
      painted.b += bleed;
      if (painted.r > painted.l && painted.b > painted.t) {
        const visible = clip ? intersect(painted, clip) : painted;
        if (visible) add(visible);
      }
      const clips = cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
      if (!clips) {
        walk(child, clip, turned);
        continue;
      }
      const childClip = clip ? intersect(own, clip) : own;
      if (childClip) walk(child, childClip, turned);
    }
  };
  walk(inner, null, false);
  if (!total) return null;
  const cRect = inner.getBoundingClientRect();
  inner.style.transform =
    'translate(' + -(total.l - cRect.left) + 'px, ' + -(total.t - cRect.top) + 'px)';
  const width = Math.max(1, Math.ceil(total.r - total.l));
  const height = Math.max(1, Math.ceil(total.b - total.t));
  const root = document.getElementById('penpot-root');
  if (root) {
    root.style.width = width + 'px';
    root.style.height = height + 'px';
  }
  return { width, height };
})()`;

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
  const scale = input.scale ?? 1;
  if (scale !== 1 && !input.fullSize) {
    // Caps are in CSS px; scaling an inline image would blow past them.
    throw new Error('`scale` needs a fullSize render (get_screenshot with outputPath).');
  }
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: scale,
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
      // Force a layout (getBoundingClientRect) so the font requests get queued, wait
      // for them, then explicitly load every used family / weight pair as a
      // belt-and-braces in case a hidden element triggered the layout.
      document.documentElement.getBoundingClientRect();
      try {
        await document.fonts.ready;
      } catch {
        /* ignore */
      }
      const families = new Set<string>();
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
        const cs = getComputedStyle(el);
        if (!cs.fontFamily) continue;
        const family = cs.fontFamily
          .split(',')[0]!
          .trim()
          .replace(/^['"]|['"]$/g, '');
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

    const box = (await page.evaluate(MEASURE_SOURCE)) as { width: number; height: number } | null;

    if (!box) {
      throw new Error('Could not measure rendered content (empty bounding box).');
    }

    if (input.fullSize) {
      const devW = Math.ceil(box.width * scale);
      const devH = Math.ceil(box.height * scale);
      if (Math.max(devW, devH) > MAX_EXPORT_SIDE_PX || devW * devH > MAX_EXPORT_PIXELS) {
        throw new Error(
          `Content is too large to render in one PNG: ${box.width}×${box.height} px at ${scale}x ` +
            `is ${devW}×${devH} device px (limits: ${MAX_EXPORT_SIDE_PX} px per side, ` +
            `${MAX_EXPORT_PIXELS / 1e6} MP). Use a lower scale or export a smaller shape.`,
        );
      }
    }
    if (Math.floor(box.width * scale) < 1 || Math.floor(box.height * scale) < 1) {
      throw new Error(
        `Content is too small to render: ${box.width}×${box.height} px at ${scale}x is under one device pixel.`,
      );
    }
    const maxW = input.fullSize
      ? box.width
      : Math.max(1, input.maxWidth ?? DEFAULT_SCREENSHOT_MAX_WIDTH);
    const maxH = input.fullSize
      ? box.height
      : Math.max(1, input.maxHeight ?? DEFAULT_SCREENSHOT_MAX_HEIGHT);
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
      pixelWidth: buffer.readUInt32BE(16),
      pixelHeight: buffer.readUInt32BE(20),
      width,
      height,
      fullWidth: box.width,
      fullHeight: box.height,
      trimmed,
      scale,
    };
  } finally {
    await context.close();
  }
}
