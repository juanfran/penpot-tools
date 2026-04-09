import type { Page, Shape, Uuid } from '../penpot.types';

/** Information about a font used in the converted output */
export interface FontInfo {
  fontFamily: string;
  fontWeight?: string;
  fontStyle?: string;
}

/** Result of a convert operation */
export interface ConvertResult {
  html: string;
  fonts: FontInfo[];
}

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
  /** @internal Page-absolute X offset of the nearest positioned ancestor (for relative positioning) */
  _offsetX?: number;
  /** @internal Page-absolute Y offset of the nearest positioned ancestor (for relative positioning) */
  _offsetY?: number;
  /** @internal When true, the shape is a direct child of the root canvas frame and must use translate-based positioning */
  _isCanvasTopLevel?: boolean;
  /** @internal Collects font info during rendering; populated by text renderers */
  _fontCollector?: Map<string, FontInfo>;
}

/** Convert a full Penpot page to an HTML document string */
export function convertPage(_page: Page, _ctx: ConverterContext): ConvertResult {
  throw new Error('not implemented');
}

/** Convert a single shape and all its descendants to an HTML snippet */
export function convertShape(
  _shape: Shape,
  _allObjects: Record<string, Shape>,
  _ctx: ConverterContext,
): Promise<ConvertResult> {
  throw new Error('not implemented');
}
