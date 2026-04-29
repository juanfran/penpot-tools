import type { FileChange, Shape, Uuid } from '@penpot-tools/converter/types';

/**
 * Subset of CSSStyleDeclaration that the builder reads. The headless walker
 * picks these explicitly so the over-the-wire payload is bounded — `getComputedStyle`
 * returns hundreds of properties most of which we never touch.
 */
export interface PickedComputedStyle {
  display: string;
  position: string;
  transform: string;
  opacity: string;
  mixBlendMode: string;
  filter: string;
  backgroundColor: string;
  backgroundImage: string;
  borderTopWidth: string;
  borderRightWidth: string;
  borderBottomWidth: string;
  borderLeftWidth: string;
  borderTopColor: string;
  borderTopStyle: string;
  borderTopLeftRadius: string;
  borderTopRightRadius: string;
  borderBottomRightRadius: string;
  borderBottomLeftRadius: string;
  boxShadow: string;
  flexDirection: string;
  justifyContent: string;
  alignItems: string;
  rowGap: string;
  columnGap: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  gridTemplateColumns: string;
  gridTemplateRows: string;
  gridRowStart: string;
  gridColumnStart: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  lineHeight: string;
  letterSpacing: string;
  color: string;
  textAlign: string;
  flexGrow: string;
  flexShrink: string;
  flexBasis: string;
  width: string;
  height: string;
}

export type SemanticTag =
  | 'div'
  | 'span'
  | 'header'
  | 'footer'
  | 'main'
  | 'section'
  | 'article'
  | 'aside'
  | 'nav'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'p'
  | 'a'
  | 'button'
  | 'label'
  | 'input'
  | 'img'
  | 'svg'
  | 'ul'
  | 'ol'
  | 'li'
  | 'form'
  | string;

export interface MeasuredRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Snapshot of a single DOM element collected by the in-page walker. Each node
 * carries enough information for the builder to emit a Penpot Shape without
 * re-querying the DOM.
 */
export interface MeasuredNode {
  /** Index in the document-order pre-order walk; used as primary key. */
  index: number;
  parentIndex: number | null;
  childIndices: number[];

  semanticTag: SemanticTag;
  /** Bounding rect, already shifted so the root sits at (0, 0). */
  rect: MeasuredRect;
  /**
   * Untransformed dimensions (`offsetWidth`/`offsetHeight`). When the element
   * has a CSS `transform`, `rect` is the axis-aligned bounding box of the
   * rendered (rotated/scaled) shape — `offsetWidth/Height` give the element's
   * natural size before the transform was applied.
   */
  offsetWidth: number;
  offsetHeight: number;
  computedStyle: PickedComputedStyle;

  /** Text content if this element has only a single text node child (no element children). */
  textContent?: string;

  /** `data-*` attributes preserved verbatim. */
  dataAttrs: Record<string, string>;

  /**
   * Raw `style` attribute string (verbatim, before browser resolution). Used to
   * detect `var(--token-name, fallback)` references — these are erased in the
   * computed style after the browser resolves them, so we have to scan the
   * authored values to surface token applications.
   */
  inlineStyle?: string;

  /** Set when the author already provided a stable id via `data-penpot-id`. */
  preserveId?: string;

  /** Image source for `<img>` elements. */
  imageSrc?: string;
  /** Penpot media id from `data-penpot-media-id` (uploaded via upload_media). */
  imageMediaId?: string;
  /** Optional MIME hint from `data-penpot-media-type`. */
  imageMediaType?: string;
  imageNaturalWidth?: number;
  imageNaturalHeight?: number;

  /** Inline `<svg>` outer HTML, preserved as-is for svg-raw shapes. */
  svgOuter?: string;
}

/**
 * Optional context for `htmlToChanges`. Most fields default to sensible values
 * — `pageId` is the only one a caller normally has to set.
 */
export interface BuildContext {
  pageId: Uuid;
  /** Parent under which the new top-level shape is attached. Defaults to the page root. */
  parentId?: Uuid;
  /** `frame-id` for the new top-level shape. Defaults to the page root. */
  frameId?: Uuid;
  /** Name applied to the top-level board created by `create_design_from_html`. */
  rootName?: string;
  /** Position of the top-level board on the page. Defaults to (0, 0). */
  rootPosition?: { x: number; y: number };
  /** Optional :root { ... } CSS injected before measuring (token resolution). */
  tokensCss?: string;
  /** Optional @font-face CSS injected before measuring. */
  fontsCss?: string;
  /** Background of the headless document; only matters for measuring. */
  background?: string;
  /** Hard cap for the headless viewport. */
  maxWidth?: number;
  maxHeight?: number;
}

export interface ChangeBundle {
  /** Penpot file changes to send to update-file. */
  changes: FileChange[];
  /** Top-level shape created (board/frame). */
  rootShapeId: Uuid;
  /** Every shape created by this bundle, in document order. */
  createdShapeIds: Uuid[];
  /** Warnings about CSS we couldn't translate (LLM should fix). */
  warnings: string[];
  /** Distinct token names referenced via `var(--...)`. */
  referencedTokens: string[];
}

export type CreatedShape = Shape;
