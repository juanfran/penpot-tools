import type { Page, Shape } from '../penpot.types';
import type { ConverterContext, ConvertResult, FontInfo } from './types';
import { renderShape } from './render';
import { renderPage } from './page';
import * as prettier from 'prettier';

function extractFonts(collector: Map<string, FontInfo>): FontInfo[] {
  return Array.from(collector.values());
}

/**
 * Converts a full Penpot page to an HTML string (body content only, no `<html>` wrapper).
 */
export function convertPage(page: Page, ctx: ConverterContext): ConvertResult {
  const fontCollector = new Map<string, FontInfo>();
  const html = renderPage(page, { ...ctx, _fontCollector: fontCollector });
  return { html, fonts: extractFonts(fontCollector) };
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
): Promise<ConvertResult> {
  const config = await prettier.resolveConfig(import.meta.url);
  const fontCollector = new Map<string, FontInfo>();

  const isRootFrame = shape.parentId === shape.id;
  let html: string;

  if (isRootFrame) {
    // Root frame is never rendered — render its children directly
    const childIds = ((shape as Shape & { shapes?: string[] }).shapes) ?? [];
    const canvasCtx: ConverterContext = { ...ctx, _isCanvasTopLevel: true, _fontCollector: fontCollector };
    html = childIds
      .map((id) => {
        const child = allObjects[id];
        return child ? renderShape(child, allObjects, canvasCtx) : '';
      })
      .join('');
  } else {
    html = renderShape(shape, allObjects, { ...ctx, _forceRelative: true, _fontCollector: fontCollector });
  }

  return {
    html: await prettier.format(html, { ...config, parser: 'html' }),
    fonts: extractFonts(fontCollector),
  };
}

export type { ConverterContext, ConvertResult, FontInfo };
