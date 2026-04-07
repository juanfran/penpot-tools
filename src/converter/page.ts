import type { Page } from '../penpot.types';
import type { ConverterContext } from './types';
import { buildTree } from './tree';
import { renderShape } from './render';

/**
 * Converts a full Penpot `Page` to an HTML string.
 *
 * Uses `buildTree` to find the root frame, then delegates to `renderShape`.
 * The root frame is always rendered with `relative` positioning (parentId === id).
 * If `page.options.background` is set, the background colour is applied via a
 * `bg-[#color]` Tailwind class on the root frame wrapper div.
 */
export function renderPage(page: Page, ctx: ConverterContext): string {
  const root = buildTree(page.objects);

  // Inject background colour by adding a fill to a context-derived bg class.
  // We do this by wrapping with a bg class when the page has a background option.
  const bgCtx: ConverterContext = page.options?.background
    ? { ...ctx, _pageBackground: page.options.background }
    : ctx;

  return renderShape(root, null, page.objects, bgCtx);
}
