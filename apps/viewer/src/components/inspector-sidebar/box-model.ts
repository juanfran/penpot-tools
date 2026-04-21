import { parseStyleDecls } from './styles';

export interface BoxModel {
  width: number;
  height: number;
  padding: [number, number, number, number];
  border: [number, number, number, number];
}

export interface Margins {
  top: number | null;
  right: number | null;
  bottom: number | null;
  left: number | null;
}

export const EMPTY_MARGINS: Margins = { top: null, right: null, bottom: null, left: null };

function parsePx(value: string | null | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
}

// Expand a CSS shorthand into [top, right, bottom, left]
function expandSides(shorthand: string | null | undefined): [number, number, number, number] {
  if (!shorthand || shorthand === 'none' || shorthand === '0') return [0, 0, 0, 0];
  const parts = shorthand.trim().split(/\s+/);
  const vals = parts.map(parsePx);
  if (vals.length === 1) return [vals[0], vals[0], vals[0], vals[0]];
  if (vals.length === 2) return [vals[0], vals[1], vals[0], vals[1]];
  if (vals.length === 3) return [vals[0], vals[1], vals[2], vals[1]];
  return [vals[0], vals[1], vals[2], vals[3]];
}

// Extract border width from shorthand like "1px solid #000" or "2px"
function parseBorderShorthand(value: string | null | undefined): number {
  if (!value || value === 'none' || value === '0') return 0;
  const first = value.trim().split(/\s+/)[0];
  return parsePx(first ?? null);
}

function nearestDataIdAncestor(el: Element): Element | null {
  let p: Element | null = el.parentElement;
  while (p) {
    if (p.hasAttribute('data-id')) return p;
    p = p.parentElement;
  }
  return null;
}

// Canvas applies a CSS transform for zoom; read its scale to convert screen
// pixels back to design pixels.
function readCanvasScale(): number {
  const el = document.querySelector<HTMLElement>('.react-transform-component');
  if (!el) return 1;
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return 1;
  const m = new DOMMatrix(t);
  return m.a || 1;
}

// For the selected shape, find the closest shape-sibling gap on each side.
// "Shape siblings" share the same nearest-data-id ancestor, treating wrapper
// divs without data-id as transparent.
export function computeMargins(selectedShapeId: string): Margins {
  if (typeof document === 'undefined') return EMPTY_MARGINS;

  const selected = document.querySelector<HTMLElement>(
    `[data-id="${CSS.escape(selectedShapeId)}"]`,
  );
  if (!selected) return EMPTY_MARGINS;

  const scale = readCanvasScale();
  if (!isFinite(scale) || scale === 0) return EMPTY_MARGINS;

  const parent = nearestDataIdAncestor(selected);
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('[data-id]'));
  const siblings = candidates.filter((c) => c !== selected && nearestDataIdAncestor(c) === parent);

  if (siblings.length === 0) return EMPTY_MARGINS;

  const selRect = selected.getBoundingClientRect();
  const out: Margins = { top: null, right: null, bottom: null, left: null };
  const EPS = 0.5;

  for (const sib of siblings) {
    const r = sib.getBoundingClientRect();
    if (r.right <= selRect.left + EPS) {
      const gap = (selRect.left - r.right) / scale;
      if (out.left === null || gap < out.left) out.left = gap;
    }
    if (r.left >= selRect.right - EPS) {
      const gap = (r.left - selRect.right) / scale;
      if (out.right === null || gap < out.right) out.right = gap;
    }
    if (r.bottom <= selRect.top + EPS) {
      const gap = (selRect.top - r.bottom) / scale;
      if (out.top === null || gap < out.top) out.top = gap;
    }
    if (r.top >= selRect.bottom - EPS) {
      const gap = (r.top - selRect.bottom) / scale;
      if (out.bottom === null || gap < out.bottom) out.bottom = gap;
    }
  }

  return out;
}

export function extractBoxModel(
  html: string,
  shapeId: string,
  nodeWidth: number,
  nodeHeight: number,
): BoxModel {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const el = doc.querySelector(`[data-id="${shapeId}"]`) as HTMLElement | null;

  const zero4: [number, number, number, number] = [0, 0, 0, 0];

  if (!el) return { width: nodeWidth, height: nodeHeight, padding: zero4, border: zero4 };

  // The rendered element might be the flex-child inner div (width: 100%; height: 100%).
  // Real layout styles live on it directly. If it has no meaningful styles, try first child.
  let styleEl: HTMLElement = el;
  let decls = parseStyleDecls(el.getAttribute('style') ?? '');
  const meaningful = decls.filter(({ prop }) => prop !== 'width' && prop !== 'height');
  if (meaningful.length === 0 && el.children.length === 1) {
    styleEl = el.firstElementChild as HTMLElement;
    decls = parseStyleDecls(styleEl?.getAttribute('style') ?? '');
  }

  const get = (prop: string) => decls.find((d) => d.prop === prop)?.value ?? null;
  const getPx = (prop: string, fallback: number) => {
    const v = get(prop);
    return v !== null ? parsePx(v) : fallback;
  };

  // --- Padding ---
  const [pt0, pr0, pb0, pl0] = expandSides(get('padding'));
  const padding: [number, number, number, number] = [
    getPx('padding-top', pt0),
    getPx('padding-right', pr0),
    getPx('padding-bottom', pb0),
    getPx('padding-left', pl0),
  ];

  // --- Border ---
  const borderAll = parseBorderShorthand(get('border'));
  const bwShorthand = get('border-width') ?? (borderAll > 0 ? `${borderAll}px` : null);
  const [bwt0, bwr0, bwb0, bwl0] = expandSides(bwShorthand);
  const border: [number, number, number, number] = [
    getPx('border-top-width', bwt0),
    getPx('border-right-width', bwr0),
    getPx('border-bottom-width', bwb0),
    getPx('border-left-width', bwl0),
  ];

  return { width: nodeWidth, height: nodeHeight, padding, border };
}
