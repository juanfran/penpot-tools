import type { Page, Shape, Uuid } from '../penpot.types';

export interface ConverterContext {
  /** Returns a URL or data-URI for a Penpot image asset by its ID */
  resolveImageUrl(id: Uuid): string;
  /** Optional prefix for image URLs */
  baseUrl?: string;
  /** Whether to inject the Tailwind CDN script into the HTML output */
  tailwindMode: 'cdn' | 'none';
}

/** Convert a full Penpot page to an HTML document string */
export function convertPage(_page: Page, _ctx: ConverterContext): string {
  throw new Error('not implemented');
}

/** Convert a single shape and all its descendants to an HTML snippet */
export function convertShape(
  _shape: Shape,
  _allObjects: Record<string, Shape>,
  _ctx: ConverterContext,
): string {
  throw new Error('not implemented');
}
