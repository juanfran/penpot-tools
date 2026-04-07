import type { Page, Shape, Uuid } from '../penpot.types';

export interface ConverterContext {
  /** Returns a URL or data-URI for a Penpot image asset by its ID */
  resolveImageUrl(id: Uuid): string;
  /** Optional prefix for image URLs */
  baseUrl?: string;
  /** @internal When true, shape renderers skip absolute positioning (parent is flex/grid) */
  _parentIsLayout?: boolean;
  /** @internal Page background color applied to the root frame */
  _pageBackground?: string;
  /** @internal When true, the shape uses relative positioning instead of absolute */
  _forceRelative?: boolean;
  /** @internal When true, shapes with fixedScroll use `fixed` positioning instead of `absolute` */
  _isChildOfRoot?: boolean;
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
