import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import z from 'zod';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  buildPenpotFontsCss,
  convertShape,
  type ConverterContext,
} from '@penpot-tools/converter';
import { extractTokens, tokensToCss } from '@penpot-tools/converter/tokens';
import type { Page, Uuid } from '@penpot-tools/penpot-types';
import { rpc } from './penpot-api-utils.server';

const BASE_URL = 'https://design.penpot.app';

function getFontsBaseUrl(): string {
  return `${new URL(getRequest().url).origin}/proxy-fonts`;
}

export type ShapeCodeFormat = 'html' | 'jsx';
export type ShapeCodeStyling = 'css' | 'tailwind';

export interface ShapeCodeResult {
  /** HTML or JSX with `class` / `className` references (no inline styles). */
  code: string;
  /** Class definitions when `styling === 'css'`. Empty string for tailwind. */
  css: string;
  fontsCss: string;
  tokensCss: string;
}

export const getShapeCodeFn = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      fileId: z.uuid(),
      pageId: z.uuid(),
      shapeId: z.uuid(),
      format: z.enum(['html', 'jsx']),
      styling: z.enum(['css', 'tailwind']),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<ShapeCodeResult> => {
    const page = await rpc<Page>(context.token, 'get-page', {
      params: { 'file-id': data.fileId, 'page-id': data.pageId },
    });
    const shape = page.objects[data.shapeId];
    if (!shape) {
      throw new Error(`Shape ${data.shapeId} not found in page ${data.pageId}.`);
    }

    const tokens = extractTokens(page.objects);
    const ctx: ConverterContext = {
      resolveImageUrl: (id: Uuid) => `${BASE_URL}/assets/by-file-media-id/${id}`,
      tokens,
      // We format below with oxfmt using the right extension; skip the
      // converter's own formatting step.
      format: false,
    };
    const { html, fonts } = await convertShape(shape, page.objects, ctx);

    const classAttr = data.format === 'jsx' ? 'className' : 'class';
    const { html: classed, css } =
      data.styling === 'tailwind'
        ? { html: stylesToTailwind(html, classAttr), css: '' }
        : stylesToCssClasses(html, classAttr);

    const fileName = data.format === 'jsx' ? 'shape.jsx' : 'shape.html';

    const oxfmt = await import('oxfmt');
    const { code } = await oxfmt.format(fileName, classed);
    // oxfmt treats a bare JSX fragment as an expression statement and emits a
    // trailing `;` — undesirable for a snippet meant to be pasted into a JSX
    // context.
    const codeOut = data.format === 'jsx' ? code.replace(/;\s*$/, '\n') : code;

    const cssOut = css ? (await oxfmt.format('shape.css', css)).code : '';

    return {
      code: codeOut,
      css: cssOut,
      fontsCss: await buildPenpotFontsCss(fonts, { baseUrl: getFontsBaseUrl() }),
      tokensCss: tokensToCss(tokens),
    };
  });

const STYLE_ATTR_RE = /\sstyle="([^"]*)"/g;

/**
 * Replace every `style="..."` attribute with a deduped class reference and
 * return the collected class definitions as a CSS string. Two elements with
 * identical declaration strings share the same class.
 */
export function stylesToCssClasses(
  html: string,
  classAttr: 'class' | 'className',
): { html: string; css: string } {
  const classByDecls = new Map<string, string>();
  const rules: string[] = [];
  let counter = 0;

  const newHtml = html.replace(STYLE_ATTR_RE, (_match, declarations: string) => {
    const decoded = decodeHtmlEntities(declarations).trim();
    if (!decoded) return '';
    let cls = classByDecls.get(decoded);
    if (!cls) {
      counter += 1;
      cls = `s-${counter}`;
      classByDecls.set(decoded, cls);
      rules.push(`.${cls} { ${decoded.replace(/;\s*$/, '')}; }`);
    }
    return ` ${classAttr}="${cls}"`;
  });

  return { html: newHtml, css: rules.join('\n') };
}

/**
 * Replace every `style="..."` attribute with a Tailwind utility-class string.
 * Each declaration the converter emits maps to either a known utility or a
 * Tailwind v4 arbitrary-value/property fallback (`[prop:value]`), so the
 * round-trip preserves the visual.
 */
export function stylesToTailwind(html: string, classAttr: 'class' | 'className'): string {
  return html.replace(STYLE_ATTR_RE, (_match, declarations: string) => {
    const decoded = decodeHtmlEntities(declarations);
    const utilities: string[] = [];
    for (const decl of decoded.split(';')) {
      const idx = decl.indexOf(':');
      if (idx < 0) continue;
      const prop = decl.slice(0, idx).trim().toLowerCase();
      const value = decl.slice(idx + 1).trim();
      if (!prop || !value) continue;
      const util = declToTailwind(prop, value);
      if (util) utilities.push(util);
    }
    if (utilities.length === 0) return '';
    return ` ${classAttr}="${utilities.join(' ')}"`;
  });
}

/**
 * Map a single CSS declaration to a Tailwind utility. Falls back to the
 * v4 arbitrary-property form `[prop:value]` for anything not handled
 * explicitly — keeps the output visually identical even for niche props.
 */
export function declToTailwind(prop: string, value: string): string | null {
  const v = value;
  switch (prop) {
    case 'display':
      if (v === 'flex') return 'flex';
      if (v === 'grid') return 'grid';
      if (v === 'block') return 'block';
      if (v === 'inline-block') return 'inline-block';
      if (v === 'inline') return 'inline';
      if (v === 'inline-flex') return 'inline-flex';
      if (v === 'none') return 'hidden';
      return arb(prop, v);
    case 'position':
      return ['static', 'relative', 'absolute', 'fixed', 'sticky'].includes(v)
        ? v
        : arb(prop, v);
    case 'top': return `top-[${tw(v)}]`;
    case 'right': return `right-[${tw(v)}]`;
    case 'bottom': return `bottom-[${tw(v)}]`;
    case 'left': return `left-[${tw(v)}]`;
    case 'z-index': return `z-[${tw(v)}]`;
    case 'width':
      if (v === '100%') return 'w-full';
      if (v === 'auto') return 'w-auto';
      return `w-[${tw(v)}]`;
    case 'height':
      if (v === '100%') return 'h-full';
      if (v === 'auto') return 'h-auto';
      return `h-[${tw(v)}]`;
    case 'min-width': return `min-w-[${tw(v)}]`;
    case 'min-height': return `min-h-[${tw(v)}]`;
    case 'max-width': return `max-w-[${tw(v)}]`;
    case 'max-height': return `max-h-[${tw(v)}]`;
    case 'margin': return `m-[${tw(v)}]`;
    case 'padding': return `p-[${tw(v)}]`;
    case 'flex-direction':
      if (v === 'row') return 'flex-row';
      if (v === 'column') return 'flex-col';
      if (v === 'row-reverse') return 'flex-row-reverse';
      if (v === 'column-reverse') return 'flex-col-reverse';
      return arb(prop, v);
    case 'flex-wrap':
      if (v === 'wrap') return 'flex-wrap';
      if (v === 'nowrap') return 'flex-nowrap';
      if (v === 'wrap-reverse') return 'flex-wrap-reverse';
      return arb(prop, v);
    case 'justify-content':
      if (v === 'flex-start') return 'justify-start';
      if (v === 'flex-end') return 'justify-end';
      if (v === 'center') return 'justify-center';
      if (v === 'space-between') return 'justify-between';
      if (v === 'space-around') return 'justify-around';
      if (v === 'space-evenly') return 'justify-evenly';
      return arb(prop, v);
    case 'align-items':
      if (v === 'flex-start') return 'items-start';
      if (v === 'flex-end') return 'items-end';
      if (v === 'center') return 'items-center';
      if (v === 'stretch') return 'items-stretch';
      if (v === 'baseline') return 'items-baseline';
      return arb(prop, v);
    case 'align-self':
      if (v === 'auto') return 'self-auto';
      if (v === 'flex-start') return 'self-start';
      if (v === 'flex-end') return 'self-end';
      if (v === 'center') return 'self-center';
      if (v === 'stretch') return 'self-stretch';
      if (v === 'baseline') return 'self-baseline';
      return arb(prop, v);
    case 'justify-self':
      if (v === 'auto') return 'justify-self-auto';
      if (v === 'start') return 'justify-self-start';
      if (v === 'end') return 'justify-self-end';
      if (v === 'center') return 'justify-self-center';
      if (v === 'stretch') return 'justify-self-stretch';
      return arb(prop, v);
    case 'gap': return `gap-[${tw(v)}]`;
    case 'row-gap': return `gap-y-[${tw(v)}]`;
    case 'column-gap': return `gap-x-[${tw(v)}]`;
    case 'flex':
      if (v === '1' || v === '1 1 0%') return 'flex-1';
      if (v === 'auto' || v === '1 1 auto') return 'flex-auto';
      if (v === 'none' || v === '0 0 auto') return 'flex-none';
      return arb(prop, v);
    case 'flex-shrink':
      if (v === '0') return 'shrink-0';
      if (v === '1') return 'shrink';
      return arb(prop, v);
    case 'grid-template-columns': return arb(prop, v);
    case 'grid-template-rows': return arb(prop, v);
    case 'grid-row-start': return `[grid-row-start:${tw(v)}]`;
    case 'grid-row-end': return `[grid-row-end:${tw(v)}]`;
    case 'grid-column-start': return `[grid-column-start:${tw(v)}]`;
    case 'grid-column-end': return `[grid-column-end:${tw(v)}]`;
    case 'background':
    case 'background-color':
      return `bg-[${tw(v)}]`;
    case 'background-image': return `bg-[image:${tw(v)}]`;
    case 'background-position': return `bg-[position:${tw(v)}]`;
    case 'background-repeat':
      if (v === 'no-repeat') return 'bg-no-repeat';
      if (v === 'repeat') return 'bg-repeat';
      return arb(prop, v);
    case 'background-size':
      if (v === 'cover') return 'bg-cover';
      if (v === 'contain') return 'bg-contain';
      return `bg-[length:${tw(v)}]`;
    case 'color': return `text-[${tw(v)}]`;
    case 'border': return arb(prop, v);
    case 'border-radius':
      if (v === '50%') return 'rounded-full';
      return `rounded-[${tw(v)}]`;
    case 'box-shadow': return `shadow-[${tw(v)}]`;
    case 'opacity': return `opacity-[${tw(v)}]`;
    case 'overflow':
      if (v === 'hidden') return 'overflow-hidden';
      if (v === 'auto') return 'overflow-auto';
      if (v === 'scroll') return 'overflow-scroll';
      if (v === 'visible') return 'overflow-visible';
      return arb(prop, v);
    case 'font-family': return `font-[${tw(v)}]`;
    case 'font-size': return `text-[${tw(v)}]`;
    case 'font-weight':
      if (v === '100') return 'font-thin';
      if (v === '200') return 'font-extralight';
      if (v === '300') return 'font-light';
      if (v === '400') return 'font-normal';
      if (v === '500') return 'font-medium';
      if (v === '600') return 'font-semibold';
      if (v === '700') return 'font-bold';
      if (v === '800') return 'font-extrabold';
      if (v === '900') return 'font-black';
      return arb(prop, v);
    case 'font-style':
      if (v === 'italic') return 'italic';
      if (v === 'normal') return 'not-italic';
      return arb(prop, v);
    case 'line-height': return `leading-[${tw(v)}]`;
    case 'letter-spacing': return `tracking-[${tw(v)}]`;
    case 'text-align':
      if (['left', 'center', 'right', 'justify', 'start', 'end'].includes(v)) {
        return `text-${v}`;
      }
      return arb(prop, v);
    case 'text-transform':
      if (v === 'uppercase') return 'uppercase';
      if (v === 'lowercase') return 'lowercase';
      if (v === 'capitalize') return 'capitalize';
      if (v === 'none') return 'normal-case';
      return arb(prop, v);
    case 'text-decoration': return arb(prop, v);
    case 'white-space':
      if (v === 'nowrap') return 'whitespace-nowrap';
      if (v === 'pre') return 'whitespace-pre';
      if (v === 'pre-line') return 'whitespace-pre-line';
      if (v === 'pre-wrap') return 'whitespace-pre-wrap';
      if (v === 'normal') return 'whitespace-normal';
      return arb(prop, v);
    case 'transform': return arb(prop, v);
    case 'filter': return arb(prop, v);
    case 'backdrop-filter': return arb(prop, v);
    case 'mix-blend-mode':
      if (v === 'multiply') return 'mix-blend-multiply';
      if (v === 'screen') return 'mix-blend-screen';
      if (v === 'overlay') return 'mix-blend-overlay';
      if (v === 'darken') return 'mix-blend-darken';
      if (v === 'lighten') return 'mix-blend-lighten';
      if (v === 'difference') return 'mix-blend-difference';
      if (v === 'exclusion') return 'mix-blend-exclusion';
      if (v === 'hue') return 'mix-blend-hue';
      if (v === 'saturation') return 'mix-blend-saturation';
      if (v === 'color') return 'mix-blend-color';
      if (v === 'luminosity') return 'mix-blend-luminosity';
      return arb(prop, v);
    default:
      return arb(prop, v);
  }
}

/** Tailwind v4 arbitrary-property form. */
function arb(prop: string, value: string): string {
  return `[${prop}:${tw(value)}]`;
}

/**
 * Tailwind arbitrary values cannot contain whitespace; the convention is to
 * use `_` as a space stand-in. Strip wrapping double quotes too — they confuse
 * the class-attribute parser and Tailwind already treats the value verbatim.
 */
function tw(value: string): string {
  return value.replace(/\s+/g, '_').replace(/"/g, '');
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}
