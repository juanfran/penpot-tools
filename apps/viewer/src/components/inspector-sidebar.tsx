import { getPageShapesOptions } from '#/components/render';
import { type ShapeTreeNode } from '#/lib/server/penpot-api';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
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

function BoxModelViz({ model }: { model: BoxModel }) {
  const [bt, br, bb, bl] = model.border;
  const [pt, pr, pb, pl] = model.padding;

  const lbl = 'absolute text-[10px] font-mono leading-none select-none';

  return (
    <div className="px-4 pt-3 pb-4">
      <p className="mb-2 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
        Box model
      </p>
      {/* border — yellow */}
      <div className="relative rounded" style={{ background: '#fce28a', padding: '18px' }}>
        <span className="absolute top-0.5 left-1 text-[9px] font-medium text-yellow-700 opacity-70 select-none">
          border
        </span>
        <span className={`${lbl} top-1 left-1/2 -translate-x-1/2 text-yellow-900`}>{fmt(bt)}</span>
        <span className={`${lbl} bottom-1 left-1/2 -translate-x-1/2 text-yellow-900`}>
          {fmt(bb)}
        </span>
        <span className={`${lbl} top-1/2 left-1 -translate-y-1/2 text-yellow-900`}>{fmt(bl)}</span>
        <span className={`${lbl} top-1/2 right-1 -translate-y-1/2 text-yellow-900`}>{fmt(br)}</span>
        {/* padding — green */}
        <div className="relative rounded" style={{ background: '#b5d99c', padding: '18px' }}>
          <span className="absolute top-0.5 left-1 text-[9px] font-medium text-green-800 opacity-70 select-none">
            padding
          </span>
          <span className={`${lbl} top-1 left-1/2 -translate-x-1/2 text-green-900`}>{fmt(pt)}</span>
          <span className={`${lbl} bottom-1 left-1/2 -translate-x-1/2 text-green-900`}>
            {fmt(pb)}
          </span>
          <span className={`${lbl} top-1/2 left-1 -translate-y-1/2 text-green-900`}>{fmt(pl)}</span>
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

  const node = findNodeById(data.tree, selectedShapeId);
  const rootNode = findRootContaining(data.tree, selectedShapeId);
  const rootShape = data.shapes.find((s) => s.id === rootNode?.id);

  if (!node || !rootShape) return null;

  const decls = extractStyles(rootShape.html, selectedShapeId);
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
        <BoxModelViz model={boxModel} />

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
      </div>
    </aside>
  );
}
