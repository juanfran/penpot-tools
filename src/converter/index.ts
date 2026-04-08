import type { Page, Shape } from '../penpot.types';
import type { ConverterContext } from './types';
import { renderShape } from './render';
import { renderPage } from './page';
import * as prettier from 'prettier';

/**
 * Converts a full Penpot page to an HTML string (body content only, no `<html>` wrapper).
 */
export function convertPage(page: Page, ctx: ConverterContext): string {
  return renderPage(page, ctx);
}

/**
 * Converts a single Penpot shape and all its descendants to a standalone HTML snippet.
 *
 * The root shape is forced to `relative` positioning so it can be embedded anywhere.
 * Returns the rendered div tree without any `<html>` or `<body>` wrapper.
 */
export async function convertShape(
  shape: Shape,
  allObjects: Record<string, Shape>,
  ctx: ConverterContext,
): Promise<string> {
  const config = await prettier.resolveConfig(import.meta.url);

  return prettier.format(
    renderShape(shape, allObjects, { ...ctx, _forceRelative: true }),
    { ...config, parser: 'html' },
  );
}

export type { ConverterContext };
