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
import type { Page, Shape, Uuid } from '@penpot-tools/penpot-types';
import { rpc } from './penpot-api-utils.server';
import { readSemanticsFor } from './semantics-fs.server';
import { type SemanticRule } from './semantics-types';

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
      /**
       * Keep the converter's `data-id` / `data-type` / `data-name` etc. on the
       * output. Default `false` — those attrs are useful for the inspector
       * pipeline but pure noise once you paste the code into a project.
       */
      includeDataAttrs: z.boolean().optional(),
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
    // Resolve semantic-rule overrides server-side from the per-file store —
    // the client doesn't need to know the storage shape, and the rules are
    // always read fresh (no client cache lag when another team member edits).
    const rules = await readSemanticsFor(data.fileId);
    const tagOverrides = resolveTagOverrides(rules, page.objects);
    const ctx: ConverterContext = {
      resolveImageUrl: (id: Uuid) => `${BASE_URL}/assets/by-file-media-id/${id}`,
      tokens,
      tagOverride: tagOverrides.size > 0 ? (s) => tagOverrides.get(s.id) : undefined,
      // We format below with oxfmt using the right extension; skip the
      // converter's own formatting step.
      format: false,
    };
    const { html, fonts } = await convertShape(shape, page.objects, ctx);

    const classAttr = data.format === 'jsx' ? 'className' : 'class';
    const names = new Map<string, string>();
    for (const [id, s] of Object.entries(page.objects)) {
      if (s.name) names.set(id, s.name);
    }
    const { html: classed, css } =
      data.styling === 'tailwind'
        ? { html: stylesToTailwind(html, classAttr), css: '' }
        : stylesToCssClasses(html, classAttr, names);

    // Strip the converter's data-* attrs after class extraction (the regex
    // depends on `data-id` to look up layer names) but before formatting.
    const stripped = data.includeDataAttrs ? classed : stripDataAttrs(classed);

    const fileName = data.format === 'jsx' ? 'shape.jsx' : 'shape.html';

    const oxfmt = await import('oxfmt');
    const { code } = await oxfmt.format(fileName, stripped);
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

/**
 * Walks every shape in the page and decides which HTML tag should wrap it
 * based on the user-supplied semantic rules. Precedence (most specific first):
 *   1. `shape-id` — the rule's value matches `shape.id` exactly.
 *   2. `name-equals` — `shape.name` equals the rule's value (case-insensitive).
 *   3. `name-contains` — `shape.name` contains the rule's value (case-insensitive).
 * Within the same tier, earlier rules win — so the user can reorder by drag
 * (or by edit order) to break ties.
 */
export function resolveTagOverrides(
  rules: SemanticRule[],
  objects: Record<string, Shape>,
): Map<string, string> {
  const out = new Map<string, string>();
  if (rules.length === 0) return out;
  const enabled = rules.filter((r) => r.enabled);
  if (enabled.length === 0) return out;

  const byId = enabled.filter((r) => r.type === 'shape-id');
  const byEq = enabled.filter((r) => r.type === 'name-equals');
  const byContains = enabled.filter((r) => r.type === 'name-contains');

  for (const shape of Object.values(objects)) {
    const idMatch = byId.find((r) => r.value === shape.id);
    if (idMatch) {
      out.set(shape.id, idMatch.tag);
      continue;
    }
    const name = (shape.name ?? '').toLowerCase();
    const eqMatch = byEq.find((r) => r.value.toLowerCase() === name);
    if (eqMatch) {
      out.set(shape.id, eqMatch.tag);
      continue;
    }
    const containsMatch = byContains.find((r) =>
      name.includes(r.value.toLowerCase()),
    );
    if (containsMatch) out.set(shape.id, containsMatch.tag);
  }
  return out;
}

const STYLE_ATTR_RE = /\sstyle="([^"]*)"/g;
/**
 * Capture the converter's `data-id="..."` and the matching `style="..."` on
 * the same element so we can derive class names from the layer's name. The
 * converter consistently emits `data-id` before `style`, with `data-type` and
 * any other attrs in between (see converter `tag()` helper).
 */
const STYLE_WITH_ID_RE =
  /(\sdata-id="([^"]+)"[^>]*?)\sstyle="([^"]*)"/g;

/**
 * Replace every `style="..."` attribute with a deduped class reference and
 * return the collected class definitions as a CSS string. Two elements with
 * identical declaration strings share the same class. Class names are derived
 * from the layer name when available — falling back to `s-N` only for shapes
 * with no usable name.
 */
export function stylesToCssClasses(
  html: string,
  classAttr: 'class' | 'className',
  names: Map<string, string>,
): { html: string; css: string } {
  const classByDecls = new Map<string, string>();
  const usedSlugs = new Map<string, number>();
  const rules: string[] = [];
  let fallbackCounter = 0;

  const newHtml = html.replace(
    STYLE_WITH_ID_RE,
    (_match, prefix: string, shapeId: string, declarations: string) => {
      const decoded = decodeHtmlEntities(declarations).trim();
      if (!decoded) return prefix;
      let cls = classByDecls.get(decoded);
      if (!cls) {
        const base = slugifyName(names.get(shapeId)) ?? `s-${++fallbackCounter}`;
        const occurrences = usedSlugs.get(base) ?? 0;
        usedSlugs.set(base, occurrences + 1);
        cls = occurrences === 0 ? base : `${base}-${occurrences + 1}`;
        classByDecls.set(decoded, cls);
        rules.push(`.${cls} { ${decoded.replace(/;\s*$/, '')}; }`);
      }
      return `${prefix} ${classAttr}="${cls}"`;
    },
  );

  return { html: newHtml, css: rules.join('\n') };
}

/**
 * Layer names in Penpot are free-form strings ("Icons / token", "Hero photo
 * #2", emoji, etc). Lowercase, replace any non-alphanumeric run with `-`,
 * trim. Returns `null` when the result is empty (caller falls back to s-N).
 *
 * Note: this preserves plurality — "Icons / token" → "icons-token". Linguistic
 * singularisation isn't reliable enough to apply automatically; rename the
 * layer if you want a different class name.
 */
export function slugifyName(name: string | undefined): string | null {
  if (!name) return null;
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) return null;
  // CSS class identifiers can't start with a digit; prefix with `_` so the
  // selector parses without quoting.
  if (/^\d/.test(slug)) slug = `_${slug}`;
  return slug;
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

const DATA_ATTR_RE = /\s+data-[a-z][a-z0-9-]*="[^"]*"/gi;

/**
 * Remove every `data-*="..."` attribute from the HTML. The converter's output
 * carries `data-id`, `data-type`, `data-name`, `data-penpot-*` to power the
 * inspector — none of which the user wants when pasting the code into their
 * own project.
 */
export function stripDataAttrs(html: string): string {
  return html.replace(DATA_ATTR_RE, '');
}
