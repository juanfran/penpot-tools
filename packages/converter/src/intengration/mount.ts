import type { FontInfo } from '../converter/types';
import { tokensToCss } from '../converter/tokens';
import { buildPenpotFontsCss } from '../converter/utils/fonts';

// Mirrors Tailwind Preflight — the CSS reset applied by `cdn.tailwindcss.com` in
// `preview.mts`. Without it, elements fall back to browser defaults (notably
// `box-sizing: content-box` and default body margin) and screenshots diverge
// from what you see in `pnpm preview`.
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
body { margin: 0; line-height: inherit; }
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
`;

function injectPreflight(): void {
  if (document.head.querySelector('style[data-penpot-preflight]')) return;
  const style = document.createElement('style');
  style.dataset.penpotPreflight = '';
  style.textContent = PREFLIGHT_CSS;
  document.head.appendChild(style);
}

let fontStyleInjected = false;

async function injectPenpotFonts(fonts: readonly FontInfo[]): Promise<void> {
  if (fonts.length === 0) return;
  const css = await buildPenpotFontsCss(fonts);
  if (!css) return;
  let style = document.querySelector<HTMLStyleElement>('style[data-penpot-fonts]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.penpotFonts = '';
    document.head.appendChild(style);
  }
  style.textContent = css;
  fontStyleInjected = true;
}

function applyTokens(tokens?: Map<string, string>): void {
  const existing = document.querySelector<HTMLStyleElement>('style[data-penpot-tokens]');
  if (!tokens || tokens.size === 0) {
    existing?.remove();
    return;
  }
  const css = tokensToCss(tokens);
  const style = existing ?? document.createElement('style');
  style.dataset.penpotTokens = '';
  style.textContent = css;
  if (!existing) document.head.appendChild(style);
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
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
}

export interface MountOptions {
  html: string;
  fonts?: FontInfo[];
  tokens?: Map<string, string>;
}

/**
 * Mounts a converted Penpot HTML fragment into the page, applies tokens and fonts,
 * and waits for fonts/images to finish loading so the screenshot is deterministic.
 * Returns the container element to pass to `expect(...).toMatchScreenshot()`.
 */
export async function mount({ html, fonts, tokens }: MountOptions): Promise<HTMLElement> {
  const prev = document.getElementById('penpot-root');
  prev?.remove();

  injectPreflight();
  applyTokens(tokens);

  if (fonts && fonts.length > 0) await injectPenpotFonts(fonts);

  const container = document.createElement('div');
  container.id = 'penpot-root';
  container.style.cssText = 'position: relative;';

  const inner = document.createElement('div');
  inner.style.cssText = 'position: relative;';
  inner.innerHTML = html;
  container.appendChild(inner);
  document.body.appendChild(container);

  if (fontStyleInjected) await document.fonts.ready;
  await waitForImages(container);

  // Size container to the bounding box of its content, shifting inner so the
  // content starts at (0, 0). Needed because Penpot root-frame children use
  // `transform: translate(Xpx, Ypx)` at canvas coordinates, which would leave
  // the content far from the container origin (mostly-empty screenshot).
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
  if (Number.isFinite(minLeft)) {
    const cRect = container.getBoundingClientRect();
    const dx = minLeft - cRect.left;
    const dy = minTop - cRect.top;
    inner.style.transform = `translate(${-dx}px, ${-dy}px)`;
    container.style.width = `${Math.ceil(maxRight - minLeft)}px`;
    container.style.height = `${Math.ceil(maxBottom - minTop)}px`;
  }

  return container;
}
