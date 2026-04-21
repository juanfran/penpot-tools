import { getPageShapesOptions } from '#/components/render';
import { type ShapeTreeNode } from '#/lib/server/penpot-api';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Check, ChevronRight, Copy, Download } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Circle, Frame, GitMerge, Image, Layers, Minus, Square, Star, Type } from 'lucide-react';

function shapeIcon(type: string) {
  const cls = 'shrink-0 text-gray-400';
  switch (type) {
    case 'frame':
      return <Frame size={14} className={cls} />;
    case 'group':
      return <Layers size={14} className={cls} />;
    case 'rect':
      return <Square size={14} className={cls} />;
    case 'circle':
      return <Circle size={14} className={cls} />;
    case 'text':
      return <Type size={14} className={cls} />;
    case 'image':
      return <Image size={14} className={cls} />;
    case 'path':
      return <Minus size={14} className={cls} />;
    case 'bool':
      return <GitMerge size={14} className={cls} />;
    case 'svg-raw':
      return <Star size={14} className={cls} />;
    default:
      return <Square size={14} className={cls} />;
  }
}

function findNodeById(nodes: ShapeTreeNode[], id: string): ShapeTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNodeById(node.children, id);
    if (found) return found;
  }
  return null;
}

// Returns the top-level tree node that contains (or is) the given id
function findRootContaining(roots: ShapeTreeNode[], id: string): ShapeTreeNode | null {
  for (const root of roots) {
    if (root.id === id || findNodeById(root.children, id)) return root;
  }
  return null;
}

function parseStyleDecls(styleAttr: string): Array<{ prop: string; value: string }> {
  return styleAttr
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((decl) => {
      const idx = decl.indexOf(':');
      if (idx === -1) return null;
      return { prop: decl.slice(0, idx).trim(), value: decl.slice(idx + 1).trim() };
    })
    .filter((d): d is { prop: string; value: string } => d !== null);
}

function extractText(html: string, shapeId: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const el = doc.querySelector(`[data-id="${shapeId}"][data-type="text"]`);
  if (!el) return null;
  const paragraphs = Array.from(el.querySelectorAll('p')).map((p) => p.textContent ?? '');
  return paragraphs.join('\n');
}

function extractStyles(html: string, shapeId: string): Array<{ prop: string; value: string }> {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  let el = doc.querySelector(`[data-id="${shapeId}"]`) as HTMLElement | null;
  if (!el) return [];

  let decls = parseStyleDecls(el.getAttribute('style') ?? '');
  const meaningful = decls.filter(({ prop }) => prop !== 'width' && prop !== 'height');

  // If root only has sizing (flex-child wrapper pattern), use first child's styles
  if (meaningful.length === 0 && el.children.length === 1) {
    el = el.firstElementChild as HTMLElement;
    decls = parseStyleDecls(el?.getAttribute('style') ?? '');
  }

  const rootDecls = decls.filter(({ prop }) => prop !== 'width' && prop !== 'height');

  // Text shapes: typography lives on <p> elements, not the root div
  const isText = el.getAttribute('data-type') === 'text';
  const firstP = isText ? el.querySelector('p') : null;
  const paraDecls = firstP
    ? parseStyleDecls(firstP.getAttribute('style') ?? '').filter(
        ({ prop }) => prop !== 'width' && prop !== 'height',
      )
    : [];

  return [...rootDecls, ...paraDecls];
}

// --- Box model parsing ---

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

interface BoxModel {
  width: number;
  height: number;
  padding: [number, number, number, number];
  border: [number, number, number, number];
}

interface Margins {
  top: number | null;
  right: number | null;
  bottom: number | null;
  left: number | null;
}

const EMPTY_MARGINS: Margins = { top: null, right: null, bottom: null, left: null };

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
function computeMargins(selectedShapeId: string): Margins {
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

function extractBoxModel(
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

function fmt(n: number): string {
  return n === 0 ? '-' : String(Math.round(n * 10) / 10);
}

function fmtMargin(n: number | null): string {
  if (n === null) return '-';
  return String(Math.round(n * 10) / 10);
}

// --- Color / unit format preferences ---

type ColorFormat = 'hex' | 'rgb' | 'hsl';
type UnitFormat = 'px' | 'rem' | 'em';

const COLOR_FORMATS = ['hex', 'rgb', 'hsl'] as const;
const UNIT_FORMATS = ['px', 'rem', 'em'] as const;
const COLOR_FORMAT_KEY = 'inspector.colorFormat';
const UNIT_FORMAT_KEY = 'inspector.unitFormat';
const BASE_FONT_PX = 16;

function readPref<T extends string>(key: string, options: readonly T[], fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const v = window.localStorage.getItem(key);
  return (options as readonly string[]).includes(v ?? '') ? (v as T) : fallback;
}

function useLocalStoragePref<T extends string>(
  key: string,
  options: readonly T[],
  fallback: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => readPref(key, options, fallback));
  useEffect(() => {
    window.localStorage.setItem(key, value);
  }, [key, value]);
  return [value, setValue];
}

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseHexColor(s: string): RGBA | null {
  const m = /^#([0-9a-fA-F]{3,8})$/.exec(s);
  if (!m) return null;
  const hex = m[1];
  const len = hex.length;
  if (len === 3 || len === 4) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    const a = len === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
    return { r, g, b, a };
  }
  if (len === 6 || len === 8) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = len === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  return null;
}

function parseChannel(raw: string): number {
  return raw.endsWith('%') ? (parseFloat(raw) * 255) / 100 : parseFloat(raw);
}

function parseAlpha(raw: string | undefined): number {
  if (raw === undefined) return 1;
  return raw.endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw);
}

function parseRgbColor(s: string): RGBA | null {
  const m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (!m) return null;
  const parts = m[1]
    .replace(/\//g, ',')
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  return {
    r: parseChannel(parts[0]),
    g: parseChannel(parts[1]),
    b: parseChannel(parts[2]),
    a: parseAlpha(parts[3]),
  };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hue = (((h % 360) + 360) % 360) / 60;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hue % 2) - 1));
  let r = 0,
    g = 0,
    b = 0;
  if (hue < 1) [r, g, b] = [c, x, 0];
  else if (hue < 2) [r, g, b] = [x, c, 0];
  else if (hue < 3) [r, g, b] = [0, c, x];
  else if (hue < 4) [r, g, b] = [0, x, c];
  else if (hue < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rN = r / 255,
    gN = g / 255,
    bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rN) h = (gN - bN) / d + (gN < bN ? 6 : 0);
    else if (max === gN) h = (bN - rN) / d + 2;
    else h = (rN - gN) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

function parseHslColor(s: string): RGBA | null {
  const m = /^hsla?\(([^)]+)\)$/i.exec(s);
  if (!m) return null;
  const parts = m[1]
    .replace(/\//g, ',')
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  const h = parseFloat(parts[0]);
  const sat = parseFloat(parts[1]) / 100;
  const lig = parseFloat(parts[2]) / 100;
  const { r, g, b } = hslToRgb(h, sat, lig);
  return { r, g, b, a: parseAlpha(parts[3]) };
}

function parseColor(s: string): RGBA | null {
  if (s.startsWith('#')) return parseHexColor(s);
  if (/^rgba?\(/i.test(s)) return parseRgbColor(s);
  if (/^hsla?\(/i.test(s)) return parseHslColor(s);
  return null;
}

function to2Hex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');
}

function formatHexColor(c: RGBA): string {
  const base = `#${to2Hex(c.r)}${to2Hex(c.g)}${to2Hex(c.b)}`;
  return c.a < 1 ? `${base}${to2Hex(c.a * 255)}` : base;
}

function roundChannel(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function formatRgbColor(c: RGBA): string {
  const r = roundChannel(c.r);
  const g = roundChannel(c.g);
  const b = roundChannel(c.b);
  if (c.a < 1) return `rgba(${r}, ${g}, ${b}, ${+c.a.toFixed(3)})`;
  return `rgb(${r}, ${g}, ${b})`;
}

function formatHslColor(c: RGBA): string {
  const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
  const hh = Math.round(h);
  const ss = Math.round(s * 100);
  const ll = Math.round(l * 100);
  if (c.a < 1) return `hsla(${hh}, ${ss}%, ${ll}%, ${+c.a.toFixed(3)})`;
  return `hsl(${hh}, ${ss}%, ${ll}%)`;
}

function formatColor(c: RGBA, format: ColorFormat): string {
  switch (format) {
    case 'hex':
      return formatHexColor(c);
    case 'rgb':
      return formatRgbColor(c);
    case 'hsl':
      return formatHslColor(c);
  }
}

const COLOR_REGEX = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi;
const PX_REGEX = /(-?\d*\.?\d+)px\b/g;

function trimTrailingZeros(n: number): string {
  return String(+n.toFixed(4));
}

function transformValue(value: string, colorFormat: ColorFormat, unitFormat: UnitFormat): string {
  let out = value.replace(COLOR_REGEX, (match) => {
    const parsed = parseColor(match);
    return parsed ? formatColor(parsed, colorFormat) : match;
  });
  if (unitFormat !== 'px') {
    out = out.replace(PX_REGEX, (_m, n: string) => {
      const px = parseFloat(n);
      if (px === 0) return `0${unitFormat}`;
      return `${trimTrailingZeros(px / BASE_FONT_PX)}${unitFormat}`;
    });
  }
  return out;
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] tracking-wider text-gray-400 uppercase">{label}</span>
      <div className="inline-flex overflow-hidden rounded border border-gray-200 bg-gray-50">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={
              value === opt
                ? 'bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-800 shadow-sm'
                : 'px-1.5 py-0.5 font-mono text-[10px] text-gray-400 hover:text-gray-600'
            }
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function BoxModelViz({ model, margins }: { model: BoxModel; margins: Margins }) {
  const [bt, br, bb, bl] = model.border;
  const [pt, pr, pb, pl] = model.padding;

  const lbl = 'absolute text-[10px] font-mono leading-none select-none';

  return (
    <div className="px-4 pt-3 pb-4">
      <p className="mb-2 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
        Box model
      </p>
      {/* margin — peach */}
      <div className="relative rounded" style={{ background: '#f7cb99', padding: '18px' }}>
        <span className="absolute top-0.5 left-1 text-[9px] font-medium text-orange-800 opacity-70 select-none">
          margin
        </span>
        <span className={`${lbl} top-1 left-1/2 -translate-x-1/2 text-orange-900`}>
          {fmtMargin(margins.top)}
        </span>
        <span className={`${lbl} bottom-1 left-1/2 -translate-x-1/2 text-orange-900`}>
          {fmtMargin(margins.bottom)}
        </span>
        <span className={`${lbl} top-1/2 left-1 -translate-y-1/2 text-orange-900`}>
          {fmtMargin(margins.left)}
        </span>
        <span className={`${lbl} top-1/2 right-1 -translate-y-1/2 text-orange-900`}>
          {fmtMargin(margins.right)}
        </span>
        {/* border — yellow */}
        <div className="relative rounded" style={{ background: '#fce28a', padding: '18px' }}>
          <span className="absolute top-0.5 left-1 text-[9px] font-medium text-yellow-700 opacity-70 select-none">
            border
          </span>
          <span className={`${lbl} top-1 left-1/2 -translate-x-1/2 text-yellow-900`}>
            {fmt(bt)}
          </span>
          <span className={`${lbl} bottom-1 left-1/2 -translate-x-1/2 text-yellow-900`}>
            {fmt(bb)}
          </span>
          <span className={`${lbl} top-1/2 left-1 -translate-y-1/2 text-yellow-900`}>
            {fmt(bl)}
          </span>
          <span className={`${lbl} top-1/2 right-1 -translate-y-1/2 text-yellow-900`}>
            {fmt(br)}
          </span>
          {/* padding — green */}
          <div className="relative rounded" style={{ background: '#b5d99c', padding: '18px' }}>
            <span className="absolute top-0.5 left-1 text-[9px] font-medium text-green-800 opacity-70 select-none">
              padding
            </span>
            <span className={`${lbl} top-1 left-1/2 -translate-x-1/2 text-green-900`}>
              {fmt(pt)}
            </span>
            <span className={`${lbl} bottom-1 left-1/2 -translate-x-1/2 text-green-900`}>
              {fmt(pb)}
            </span>
            <span className={`${lbl} top-1/2 left-1 -translate-y-1/2 text-green-900`}>
              {fmt(pl)}
            </span>
            <span className={`${lbl} top-1/2 right-1 -translate-y-1/2 text-green-900`}>
              {fmt(pr)}
            </span>
            {/* content — blue */}
            <div
              className="flex items-center justify-center rounded font-mono text-xs font-semibold text-blue-900"
              style={{ background: '#9dc4e8', padding: '10px 4px' }}
            >
              {fmt(model.width)} × {fmt(model.height)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Groups properties into display sections for readability
const SECTION_ORDER: Array<{ label: string; prefixes: string[] }> = [
  {
    label: 'Position',
    prefixes: ['position', 'top', 'left', 'right', 'bottom', 'z-index', 'transform'],
  },
  {
    label: 'Layout',
    prefixes: [
      'display',
      'flex',
      'align',
      'justify',
      'gap',
      'grid',
      'padding',
      'margin',
      'flex-direction',
      'flex-wrap',
      'align-items',
      'align-content',
      'justify-content',
    ],
  },
  {
    label: 'Visual',
    prefixes: [
      'background',
      'border',
      'box-shadow',
      'opacity',
      'filter',
      'backdrop-filter',
      'mix-blend-mode',
      'overflow',
      'visibility',
      'color',
    ],
  },
  {
    label: 'Typography',
    prefixes: ['font', 'line-height', 'letter-spacing', 'text', 'white-space', 'word'],
  },
];

function groupStyles(decls: Array<{ prop: string; value: string }>) {
  const assigned = new Set<number>();
  const sections: Array<{ label: string; decls: Array<{ prop: string; value: string }> }> = [];

  for (const section of SECTION_ORDER) {
    const matched = decls
      .map((d, i) => ({ d, i }))
      .filter(({ d, i }) => !assigned.has(i) && section.prefixes.some((p) => d.prop.startsWith(p)));
    if (matched.length > 0) {
      matched.forEach(({ i }) => assigned.add(i));
      sections.push({ label: section.label, decls: matched.map(({ d }) => d) });
    }
  }

  const rest = decls.filter((_, i) => !assigned.has(i));
  if (rest.length > 0) {
    sections.push({ label: 'Other', decls: rest });
  }

  return sections;
}

function StyleDecl({ prop, value }: { prop: string; value: string }) {
  return (
    <div className="flex min-w-0 gap-0.5 py-0.5">
      <span className="shrink-0 text-violet-600">{prop}</span>
      <span className="text-gray-400">:</span>
      <span className="min-w-0 break-all text-amber-700">{value}</span>
      <span className="shrink-0 text-gray-400">;</span>
    </div>
  );
}

// --- Assets (images + svg-raw) inside the selected shape ---

interface Asset {
  id: string;
  name: string;
  kind: 'image' | 'svg';
  src?: string;
  svg?: string;
}

function buildNodeIndex(
  nodes: ShapeTreeNode[],
  map: Map<string, ShapeTreeNode> = new Map(),
): Map<string, ShapeTreeNode> {
  for (const n of nodes) {
    map.set(n.id, n);
    buildNodeIndex(n.children, map);
  }
  return map;
}

const BG_URL_REGEX = /url\((['"]?)([^)'"]+)\1\)/g;

// Reads assets directly from the live DOM subtree of the selected shape,
// avoiding a full reparse of the root shape's HTML (which can be huge).
//
// Covers the four render paths from the converter:
//   - <img data-type="image"> for image shapes
//   - <div data-type="svg-raw"> wrapping raw SVG markup
//   - <svg data-id="..."> for path/bool shapes (rendered as standalone SVGs)
//   - any shape with an image fill renders as background-image: url(...)
//     (rect/circle/frame/etc. — see converter/visual/fills.ts)
function collectAssetsFromDom(
  selectedShapeId: string,
  nodeIndex: Map<string, ShapeTreeNode>,
): Asset[] {
  if (typeof document === 'undefined') return [];
  const root = document.querySelector<HTMLElement>(`[data-id="${CSS.escape(selectedShapeId)}"]`);
  if (!root) return [];

  const out: Asset[] = [];
  const seenSrcs = new Set<string>();
  const seenSvgIds = new Set<string>();

  const pushImage = (id: string, name: string, src: string, layerIdx: number) => {
    if (seenSrcs.has(src)) return;
    seenSrcs.add(src);
    out.push({ id: layerIdx > 0 ? `${id}-bg-${layerIdx}` : id, name, kind: 'image', src });
  };

  const pushSvg = (id: string, name: string, svg: string) => {
    if (seenSvgIds.has(id) || !svg) return;
    seenSvgIds.add(id);
    out.push({ id, name, kind: 'svg', svg });
  };

  // Primary: <img>, <div data-type="svg-raw">, and standalone <svg data-id>
  const primaryEls: Element[] = [];
  const rootType = root.getAttribute('data-type');
  const rootIsSvg = root.tagName.toLowerCase() === 'svg';
  if (rootType === 'image' || rootType === 'svg-raw' || rootIsSvg) primaryEls.push(root);
  primaryEls.push(
    ...Array.from(
      root.querySelectorAll('[data-type="image"], [data-type="svg-raw"], svg[data-id]'),
    ),
  );

  for (const el of primaryEls) {
    const id = el.getAttribute('data-id');
    if (!id) continue;
    const name = nodeIndex.get(id)?.name ?? id;
    const type = el.getAttribute('data-type');
    const tagName = el.tagName.toLowerCase();
    if (type === 'image' && tagName === 'img') {
      const src = el.getAttribute('src');
      if (src) pushImage(id, name, src, 0);
    } else if (type === 'svg-raw') {
      pushSvg(id, name, el.innerHTML.trim());
    } else if (tagName === 'svg') {
      // Skip SVGs nested inside a svg-raw wrapper (the wrapper already owns them)
      if (el !== root && el.closest('[data-type="svg-raw"]')) continue;
      pushSvg(id, name, el.outerHTML);
    }
  }

  // Image fills rendered as background-image: url(...) on any shape type
  const bgEls: HTMLElement[] = [];
  if (root.hasAttribute('data-id') && root.style.backgroundImage) bgEls.push(root);
  bgEls.push(
    ...Array.from(root.querySelectorAll<HTMLElement>('[data-id][style*="background-image"]')),
  );

  for (const el of bgEls) {
    const id = el.getAttribute('data-id');
    if (!id) continue;
    const name = nodeIndex.get(id)?.name ?? id;
    const bg = el.style.backgroundImage;
    if (!bg || bg === 'none') continue;
    BG_URL_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    let layerIdx = 0;
    while ((m = BG_URL_REGEX.exec(bg)) !== null) {
      const src = m[2];
      // Skip intra-document references (mask/clipPath via url(#id))
      if (!src || src.startsWith('#')) continue;
      pushImage(id, name, src, layerIdx);
      layerIdx++;
    }
  }

  return out;
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned.slice(0, 200) || 'asset';
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function downloadImageAsset(src: string, baseName: string) {
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const ext = (blob.type.split('/')[1] || 'png').split(';')[0];
    triggerBlobDownload(blob, `${sanitizeFilename(baseName)}.${ext}`);
  } catch {
    // CORS or network failure — fall back to opening the asset in a new tab
    window.open(src, '_blank', 'noopener');
  }
}

function downloadSvgAsset(markup: string, baseName: string) {
  const trimmed = markup.trim();
  const hasSvgRoot = /^<svg[\s>]/i.test(trimmed);
  const content = hasSvgRoot ? trimmed : `<svg xmlns="http://www.w3.org/2000/svg">${trimmed}</svg>`;
  const blob = new Blob([content], { type: 'image/svg+xml' });
  triggerBlobDownload(blob, `${sanitizeFilename(baseName)}.svg`);
}

function AssetItem({ asset }: { asset: Asset }) {
  const [busy, setBusy] = useState(false);

  const onDownload = async () => {
    setBusy(true);
    try {
      if (asset.kind === 'image' && asset.src) {
        await downloadImageAsset(asset.src, asset.name);
      } else if (asset.kind === 'svg' && asset.svg) {
        downloadSvgAsset(asset.svg, asset.name);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50 p-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-white">
        {asset.kind === 'image' && asset.src ? (
          <img src={asset.src} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center [&>svg]:max-h-full [&>svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: asset.svg ?? '' }}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-800" title={asset.name}>
          {asset.name}
        </p>
        <p className="text-[10px] tracking-wider text-gray-400 uppercase">
          {asset.kind === 'image' ? 'Image' : 'SVG'}
        </p>
      </div>
      <button
        onClick={onDownload}
        disabled={busy}
        className="flex items-center rounded px-1.5 py-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
        title="Download"
      >
        <Download size={12} />
      </button>
    </div>
  );
}

export function InspectorSidebar({
  fileId,
  pageId,
  selectedShapeId,
}: {
  fileId: string;
  pageId: string;
  selectedShapeId: string;
}) {
  const { data } = useSuspenseQuery(getPageShapesOptions(fileId, pageId));
  const [copied, setCopied] = useState<'css' | 'text' | null>(null);
  const [margins, setMargins] = useState<Margins>(EMPTY_MARGINS);
  const [colorFormat, setColorFormat] = useLocalStoragePref<ColorFormat>(
    COLOR_FORMAT_KEY,
    COLOR_FORMATS,
    'hex',
  );
  const [unitFormat, setUnitFormat] = useLocalStoragePref<UnitFormat>(
    UNIT_FORMAT_KEY,
    UNIT_FORMATS,
    'px',
  );

  const nodeIndex = useMemo(() => buildNodeIndex(data.tree), [data.tree]);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);

  const node = findNodeById(data.tree, selectedShapeId);
  const rootNode = findRootContaining(data.tree, selectedShapeId);
  const rootShape = data.shapes.find((s) => s.id === rootNode?.id);

  useEffect(() => {
    // Wait one frame so the selected shape and its siblings are laid out.
    const raf = requestAnimationFrame(() => setMargins(computeMargins(selectedShapeId)));
    return () => cancelAnimationFrame(raf);
  }, [selectedShapeId, data]);

  // Collapse assets and drop cached list whenever the selected shape changes.
  useEffect(() => {
    setAssetsOpen(false);
    setAssets([]);
  }, [selectedShapeId]);

  const handleToggleAssets = () => {
    if (!assetsOpen) setAssets(collectAssetsFromDom(selectedShapeId, nodeIndex));
    setAssetsOpen((o) => !o);
  };

  if (!node || !rootShape) return null;

  const rawDecls = extractStyles(rootShape.html, selectedShapeId);
  const decls = rawDecls.map(({ prop, value }) => ({
    prop,
    value: transformValue(value, colorFormat, unitFormat),
  }));
  const sections = groupStyles(decls);
  const cssText = decls.map(({ prop, value }) => `${prop}: ${value};`).join('\n');
  const boxModel = extractBoxModel(rootShape.html, selectedShapeId, node.width, node.height);
  const textContent = node.type === 'text' ? extractText(rootShape.html, selectedShapeId) : null;

  const handleCopy = (kind: 'css' | 'text', value: string) => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <aside className="flex w-80 flex-col border-l border-gray-200 bg-white">
      {/* Shape header */}
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="mb-1 flex items-center gap-1.5">
          {shapeIcon(node.type)}
          <span className="text-xs font-medium text-gray-400">{node.type}</span>
        </div>
        <h2 className="truncate text-sm font-semibold text-gray-900" title={node.name}>
          {node.name}
        </h2>
      </div>

      {/* Styles */}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <BoxModelViz model={boxModel} margins={margins} />

        {textContent !== null && (
          <div className="border-t border-gray-100 px-4 pt-3 pb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Text
              </span>
              <button
                onClick={() => handleCopy('text', textContent)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                title="Copy text"
              >
                {copied === 'text' ? <Check size={11} /> : <Copy size={11} />}
                <span>{copied === 'text' ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <p className="max-h-40 overflow-auto rounded-md bg-gray-50 px-3 py-2 font-mono text-xs break-words whitespace-pre-wrap text-gray-800">
              {textContent || <span className="text-gray-400">Empty</span>}
            </p>
          </div>
        )}

        <div className="border-t border-gray-100">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
              Styles
            </span>
            {decls.length > 0 && (
              <button
                onClick={() => handleCopy('css', cssText)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                title="Copy all styles"
              >
                {copied === 'css' ? <Check size={11} /> : <Copy size={11} />}
                <span>{copied === 'css' ? 'Copied!' : 'Copy'}</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pb-2">
            <Segmented
              label="Color"
              value={colorFormat}
              onChange={setColorFormat}
              options={COLOR_FORMATS}
            />
            <Segmented
              label="Unit"
              value={unitFormat}
              onChange={setUnitFormat}
              options={UNIT_FORMATS}
            />
          </div>

          {decls.length === 0 ? (
            <p className="px-4 py-2 text-xs text-gray-400">No styles</p>
          ) : (
            <div className="space-y-3 px-4 pb-4">
              {sections.map((section) => (
                <div key={section.label}>
                  <p className="mb-1 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
                    {section.label}
                  </p>
                  <div className="rounded-md bg-gray-50 px-3 py-2 font-mono text-xs leading-relaxed">
                    {section.decls.map((d, i) => (
                      <StyleDecl key={i} prop={d.prop} value={d.value} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100">
          <button
            type="button"
            onClick={handleToggleAssets}
            className="flex w-full items-center gap-1 px-4 pt-3 pb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase transition-colors hover:text-gray-700"
          >
            <ChevronRight
              size={12}
              className={`transition-transform ${assetsOpen ? 'rotate-90' : ''}`}
            />
            Assets
            {assetsOpen && (
              <span className="ml-auto font-mono text-[10px] tracking-normal text-gray-400 normal-case">
                {assets.length}
              </span>
            )}
          </button>
          {assetsOpen && (
            <div className="flex flex-col gap-2 px-4 pb-4">
              {assets.length === 0 ? (
                <p className="text-xs text-gray-400">No assets</p>
              ) : (
                assets.map((a) => <AssetItem key={a.id} asset={a} />)
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
