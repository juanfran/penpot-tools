import { convertPage, convertShape, buildPenpotFontsCss } from '@penpot-tools/converter';
import type { ConverterContext, FontInfo } from '@penpot-tools/converter';
import { extractTokens, extractAllTokens, tokensToCss } from '@penpot-tools/converter/tokens';
import type { TokenInfo } from '@penpot-tools/converter/tokens';
import {
  pageToCode,
  shapeToCode,
  type ShapeCodeFormat,
  type ShapeCodeStyling,
} from '@penpot-tools/converter/shape-code';
import { readSemanticsFromDisk } from '@penpot-tools/converter/semantics-store';
import type { Page, Shape, ShapeType } from '@penpot-tools/converter/types';
import { fetchPage, getPenpotBase, imageUrlFor } from './penpot-api.ts';

/** Compact list of (family, weight, italic) tuples used by the page. Used to
 *  let the LLM know which fonts are involved without paying the ~35 KB
 *  @font-face block on every request. The full CSS is materialised on demand
 *  via `buildFontsCss` (still required by the screenshot pipeline). */
export interface FontUsage {
  family: string;
  weight: number;
  italic: boolean;
}

export interface PageHtmlBundle {
  pageName: string;
  html: string;
  /** Compact fonts summary — see `FontUsage`. */
  fontsUsed: FontUsage[];
  /** Lazy fetch of the full @font-face CSS (still needed by renderScreenshot
   *  and any caller that opted in via `includeFontsCss`). */
  buildFontsCss: () => Promise<string>;
  tokensCss: string;
}

function summariseFonts(fonts: readonly FontInfo[]): FontUsage[] {
  const seen = new Map<string, FontUsage>();
  for (const f of fonts) {
    const family = (f.fontFamily ?? '').replace(/^['"]|['"]$/g, '').trim();
    if (!family) continue;
    const weight = Number(f.fontWeight ?? 400) || 400;
    const italic = f.fontStyle === 'italic';
    const key = `${family}|${weight}|${italic}`;
    if (!seen.has(key)) seen.set(key, { family, weight, italic });
  }
  return [...seen.values()].sort(
    (a, b) => a.family.localeCompare(b.family) || a.weight - b.weight,
  );
}

export async function convertPageToHtml(
  token: string,
  fileId: string,
  pageId: string,
): Promise<PageHtmlBundle> {
  const page = await fetchPage(token, fileId, pageId);
  const tokens = extractTokens(page.objects);
  const ctx: ConverterContext = {
    resolveImageUrl: imageUrlFor,
    tokens,
    format: false,
  };
  const { html, fonts } = await convertPage(page, ctx);
  return {
    pageName: page.name,
    html,
    fontsUsed: summariseFonts(fonts),
    buildFontsCss: () => buildPenpotFontsCss(fonts, { baseUrl: getPenpotBase() }),
    tokensCss: tokensToCss(tokens),
  };
}

export interface ShapeHtmlBundle extends PageHtmlBundle {
  shapeId: string;
  shapeName: string;
  shapeType: string;
}

export async function convertShapeToHtml(
  token: string,
  fileId: string,
  pageId: string,
  shapeId: string,
): Promise<ShapeHtmlBundle> {
  const page = await fetchPage(token, fileId, pageId);
  const shape = page.objects[shapeId];
  if (!shape) {
    throw new Error(`Shape ${shapeId} not found in page ${pageId}`);
  }
  const tokens = extractTokens(page.objects);
  const ctx: ConverterContext = {
    resolveImageUrl: imageUrlFor,
    tokens,
    format: false,
  };
  const { html, fonts } = await convertShape(shape, page.objects, ctx);
  return {
    pageName: page.name,
    shapeId,
    shapeName: shape.name,
    shapeType: shape.type,
    html,
    fontsUsed: summariseFonts(fonts),
    buildFontsCss: () => buildPenpotFontsCss(fonts, { baseUrl: getPenpotBase() }),
    tokensCss: tokensToCss(tokens),
  };
}

export interface ShapeCodeBundle {
  pageName: string;
  shapeId: string;
  shapeName: string;
  shapeType: string;
  /** Formatted HTML or JSX with `class` / `className` references — no inline styles. */
  code: string;
  /** CSS class definitions when `styling === 'css'`. Empty for tailwind. */
  css: string;
  fontsUsed: FontUsage[];
  buildFontsCss: () => Promise<string>;
  tokensCss: string;
  /** Echo of the format/styling used so callers can label their output. */
  format: ShapeCodeFormat;
  styling: ShapeCodeStyling;
}

export interface ShapeCodeOptions {
  format?: ShapeCodeFormat;
  styling?: ShapeCodeStyling;
  /** Keep `data-id` / `data-type` / `data-name` / `data-penpot-*` on the output. */
  includeDataAttrs?: boolean;
}

/**
 * Render a Penpot shape with the same pipeline the viewer's exporter uses:
 * convertShape with semantic-tag overrides → CSS classes (named after the
 * layer) or Tailwind utilities → strip `data-*` attrs → oxfmt format. Reads
 * per-file semantic rules from the same store the viewer writes to so both
 * tools agree on `<button>` / `<a>` / `<ul>` / … classifications.
 */
export async function convertShapeToCode(
  token: string,
  fileId: string,
  pageId: string,
  shapeId: string,
  options: ShapeCodeOptions = {},
): Promise<ShapeCodeBundle> {
  const page = await fetchPage(token, fileId, pageId);
  const shape = page.objects[shapeId];
  if (!shape) {
    throw new Error(`Shape ${shapeId} not found in page ${pageId}`);
  }
  const tokens = extractTokens(page.objects);
  const ctx: ConverterContext = {
    resolveImageUrl: imageUrlFor,
    tokens,
  };
  const rules = await readSemanticsFromDisk(fileId);
  const format = options.format ?? 'html';
  const styling = options.styling ?? 'css';
  const { code, css, fonts } = await shapeToCode(shape, page.objects, ctx, {
    format,
    styling,
    includeDataAttrs: options.includeDataAttrs,
    rules,
  });
  return {
    pageName: page.name,
    shapeId,
    shapeName: shape.name,
    shapeType: shape.type,
    code,
    css,
    fontsUsed: summariseFonts(fonts),
    buildFontsCss: () => buildPenpotFontsCss(fonts, { baseUrl: getPenpotBase() }),
    tokensCss: tokensToCss(tokens),
    format,
    styling,
  };
}

export interface PageCodeBundle {
  pageName: string;
  /** Formatted HTML or JSX with `class` / `className` references — no inline styles. */
  code: string;
  /** Class definitions when `styling === 'css'`. Empty for tailwind. */
  css: string;
  fontsUsed: FontUsage[];
  buildFontsCss: () => Promise<string>;
  tokensCss: string;
  format: ShapeCodeFormat;
  styling: ShapeCodeStyling;
}

/**
 * Page-level mirror of `convertShapeToCode`. Runs the same export pipeline
 * (semantic-tag overrides → flatten text wrappers → CSS classes / Tailwind →
 * strip data-* → oxfmt) on every top-level board in one go, with shared
 * class state so identical declarations across boards collapse to a single
 * rule. Used when the MCP caller asks for the whole page.
 */
export async function convertPageToCode(
  token: string,
  fileId: string,
  pageId: string,
  options: ShapeCodeOptions = {},
): Promise<PageCodeBundle> {
  const page = await fetchPage(token, fileId, pageId);
  const tokens = extractTokens(page.objects);
  const ctx: ConverterContext = {
    resolveImageUrl: imageUrlFor,
    tokens,
  };
  const rules = await readSemanticsFromDisk(fileId);
  const format = options.format ?? 'html';
  const styling = options.styling ?? 'css';
  const { code, css, fonts } = await pageToCode(page, ctx, {
    format,
    styling,
    includeDataAttrs: options.includeDataAttrs,
    rules,
  });
  return {
    pageName: page.name,
    code,
    css,
    fontsUsed: summariseFonts(fonts),
    buildFontsCss: () => buildPenpotFontsCss(fonts, { baseUrl: getPenpotBase() }),
    tokensCss: tokensToCss(tokens),
    format,
    styling,
  };
}

export interface PageTokensBundle {
  pageName: string;
  tokens: TokenInfo[];
  css: string;
}

export async function getPageTokens(
  token: string,
  fileId: string,
  pageId: string,
): Promise<PageTokensBundle> {
  const page = await fetchPage(token, fileId, pageId);
  const all = extractAllTokens(page.objects);
  const fillTokens = extractTokens(page.objects);
  return {
    pageName: page.name,
    tokens: all,
    css: tokensToCss(fillTokens),
  };
}

export interface OverviewNode {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  childCount: number;
  descendantCount: number;
  text?: string;
  layout?: string;
  flags?: string[];
}

/** Compact recursive node used by the page tree. Bounds are [x, y, width, height]. */
export interface PageTreeNode {
  id: string;
  name: string;
  type: ShapeType | 'page';
  bounds?: [number, number, number, number];
  childCount: number;
  descendantCount: number;
  text?: string;
  layout?: string;
  flags?: string[];
  childrenOmitted?: number;
  children?: PageTreeNode[];
}

export interface OverviewMatch extends OverviewNode {
  parentId: string;
  /** Name-based breadcrumb. IDs remain the stable lookup key. */
  path: string;
  componentId?: string;
  mediaId?: string;
  tokens?: string[];
}

export interface PageOverview {
  pageName: string;
  pageId: string;
  fileId: string;
  totalShapes: number;
  typeCounts: Partial<Record<ShapeType, number>>;
  commonNames: { name: string; count: number }[];
  tree?: PageTreeNode;
  treeMeta?: {
    maxDepth: number;
    maxNodes: number;
    returnedNodes: number;
    totalNodes: number;
    truncated: boolean;
    truncatedByDepth: boolean;
    truncatedByNodeLimit: boolean;
  };
  fontsUsed: string[];
  tokenSummary: { name: string; category: string; usageCount: number }[];
  search?: {
    query?: string;
    queryFields?: OverviewQueryField[];
    types?: ShapeType[];
    scopeId?: string;
    matched: number;
    returned: number;
    truncated: boolean;
  };
  matches?: OverviewMatch[];
}

export type OverviewQueryField = 'name' | 'text' | 'path';

/** Truncate to N chars and append `…` so the response stays compact. */
function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function collectText(shape: Shape, max: number): string | undefined {
  if (shape.type !== 'text') return undefined;
  const content = (shape as Shape & { content?: { children?: unknown[] } }).content;
  if (!content?.children) return undefined;
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as { text?: string; children?: unknown[] };
    if (typeof n.text === 'string') out.push(n.text);
    if (Array.isArray(n.children)) n.children.forEach(walk);
  };
  walk(content);
  const joined = out.join(' ').trim();
  return joined ? truncate(joined, max) : undefined;
}

const DEFAULT_TREE_DEPTH = 4;
const DEFAULT_TREE_MAX_NODES = 500;
const TEXT_PREVIEW_CHARS = 80;

function childIds(shape: Shape): string[] {
  return 'shapes' in shape && Array.isArray(shape.shapes) ? shape.shapes : [];
}

function descendantCount(objects: Record<string, Shape>, shape: Shape): number {
  let count = 0;
  const visit = (id: string): void => {
    const child = objects[id];
    if (!child) return;
    count += 1;
    childIds(child).forEach(visit);
  };
  childIds(shape).forEach(visit);
  return count;
}

function shapeFlags(shape: Shape): string[] | undefined {
  const flags: string[] = [];
  if (shape.hidden) flags.push('hidden');
  if (shape.locked) flags.push('locked');
  if (shape.blocked) flags.push('blocked');
  if (shape.componentRoot) flags.push('component-root');
  if (shape.mainInstance) flags.push('main-instance');
  if (shape.remoteSynced) flags.push('remote-synced');
  return flags.length > 0 ? flags : undefined;
}

function shapeLayout(shape: Shape): string | undefined {
  if (shape.type !== 'frame' || !shape.layoutType) return undefined;
  return shape.layoutType === 'flex' ? `flex:${shape.layoutFlexDir ?? 'row'}` : 'grid';
}

function baseOverviewNode(objects: Record<string, Shape>, shape: Shape): OverviewNode {
  const children = childIds(shape);
  const node: OverviewNode = {
    id: shape.id,
    name: shape.name,
    type: shape.type,
    x: Math.round(shape.selrect.x),
    y: Math.round(shape.selrect.y),
    width: Math.round(shape.selrect.width),
    height: Math.round(shape.selrect.height),
    childCount: children.length,
    descendantCount: descendantCount(objects, shape),
  };
  const text = collectText(shape, TEXT_PREVIEW_CHARS);
  if (text) node.text = text;
  const layout = shapeLayout(shape);
  if (layout) node.layout = layout;
  const flags = shapeFlags(shape);
  if (flags) node.flags = flags;
  return node;
}

interface TreeBuildState {
  returnedNodes: number;
  truncatedByDepth: boolean;
  truncatedByNodeLimit: boolean;
}

function buildTreeNode(
  objects: Record<string, Shape>,
  id: string,
  depth: number,
  maxDepth: number,
  maxNodes: number,
  state: TreeBuildState,
): PageTreeNode | null {
  if (state.returnedNodes >= maxNodes) {
    state.truncatedByNodeLimit = true;
    return null;
  }
  const shape = objects[id];
  if (!shape) return null;
  state.returnedNodes += 1;
  const childrenIds = childIds(shape);
  const node: PageTreeNode = {
    id: shape.id,
    name: shape.name,
    type: shape.type,
    bounds: [
      Math.round(shape.selrect.x),
      Math.round(shape.selrect.y),
      Math.round(shape.selrect.width),
      Math.round(shape.selrect.height),
    ],
    childCount: childrenIds.length,
    descendantCount: descendantCount(objects, shape),
  };
  const text = collectText(shape, TEXT_PREVIEW_CHARS);
  if (text) node.text = text;
  const layout = shapeLayout(shape);
  if (layout) node.layout = layout;
  const flags = shapeFlags(shape);
  if (flags) node.flags = flags;

  if (childrenIds.length === 0) return node;
  if (depth >= maxDepth) {
    node.childrenOmitted = childrenIds.length;
    state.truncatedByDepth = true;
    return node;
  }

  const children: PageTreeNode[] = [];
  for (const childId of childrenIds) {
    const child = buildTreeNode(objects, childId, depth + 1, maxDepth, maxNodes, state);
    if (child) children.push(child);
    else if (state.returnedNodes >= maxNodes) break;
  }
  if (children.length > 0) node.children = children;
  if (children.length < childrenIds.length) {
    node.childrenOmitted = childrenIds.length - children.length;
    state.truncatedByNodeLimit = true;
  }
  return node;
}

export interface OverviewOptions {
  /** Maximum tree depth. Page root is depth 0; top-level canvas nodes are depth 1. */
  maxDepth?: number;
  /** Hard cap on shape nodes in the tree, independent of depth. */
  maxNodes?: number;
  /** Set false for a search-only follow-up call. Defaults to true. */
  includeTree?: boolean;
  /** Case-insensitive AND search across the selected query fields. */
  query?: string;
  /** Fields searched by `query`. Defaults to layer name and text. */
  queryFields?: OverviewQueryField[];
  /** Return only these Penpot node types. */
  types?: ShapeType[];
  /** Limit search to this node and its descendants. */
  scopeId?: string;
  /** Maximum number of flat search matches returned. Defaults to 50. */
  maxResults?: number;
}

function normaliseFontFamily(value: string): string {
  return value.trim().replace(/^(["'])(.*)\1$/, '$2');
}

function collectDocumentOrder(objects: Record<string, Shape>, root: Shape | undefined): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string): void => {
    if (seen.has(id)) return;
    const shape = objects[id];
    if (!shape) return;
    seen.add(id);
    ordered.push(id);
    childIds(shape).forEach(visit);
  };
  if (root) childIds(root).forEach(visit);
  for (const id of Object.keys(objects)) {
    if (id !== root?.id) visit(id);
  }
  return ordered;
}

function ancestorNames(objects: Record<string, Shape>, shape: Shape, rootId?: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>([shape.id]);
  let parentId: string | undefined = shape.parentId;
  while (parentId && parentId !== rootId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent: Shape | undefined = objects[parentId];
    if (!parent) break;
    names.unshift(parent.name);
    parentId = parent.parentId;
  }
  return names;
}

function tokenNames(shape: Shape): string[] | undefined {
  if (!shape.appliedTokens) return undefined;
  const names = [
    ...new Set(
      Object.values(shape.appliedTokens).filter((v): v is string => typeof v === 'string'),
    ),
  ];
  return names.length > 0 ? names.sort() : undefined;
}

function buildMatch(objects: Record<string, Shape>, shape: Shape, rootId?: string): OverviewMatch {
  const node = baseOverviewNode(objects, shape);
  const match: OverviewMatch = {
    ...node,
    parentId: shape.parentId,
    path: [...ancestorNames(objects, shape, rootId), shape.name].join(' > '),
  };
  if (shape.componentId) match.componentId = shape.componentId;
  if (shape.type === 'image' && shape.metadata?.id) match.mediaId = shape.metadata.id;
  const tokens = tokenNames(shape);
  if (tokens) match.tokens = tokens;
  return match;
}

/** Pure page summariser, exported so the context-budget behaviour is unit-testable. */
export function buildPageOverview(
  page: Page,
  fileId: string,
  pageId: string,
  options: OverviewOptions = {},
): PageOverview {
  const root = Object.values(page.objects).find((s) => s.parentId === s.id);
  const rootChildIds = root ? childIds(root) : [];

  const typeCounts: Partial<Record<ShapeType, number>> = {};
  const nameCounts = new Map<string, number>();
  for (const shape of Object.values(page.objects)) {
    if (shape.id === root?.id) continue;
    typeCounts[shape.type] = (typeCounts[shape.type] ?? 0) + 1;
    nameCounts.set(shape.name, (nameCounts.get(shape.name) ?? 0) + 1);
  }
  const commonNames = [...nameCounts]
    .filter(([, count]) => count > 1)
    .sort(([nameA, countA], [nameB, countB]) => countB - countA || nameA.localeCompare(nameB))
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }));

  const aggregateTokens = new Map<string, { name: string; category: string; usageCount: number }>();
  for (const token of extractAllTokens(page.objects)) {
    const key = `${token.category}\0${token.name}`;
    const current = aggregateTokens.get(key);
    if (current) current.usageCount += token.usageCount;
    else
      aggregateTokens.set(key, {
        name: token.name,
        category: token.category,
        usageCount: token.usageCount,
      });
  }
  const tokenSummary = [...aggregateTokens.values()]
    .sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name))
    .slice(0, 30);

  const fontSet = new Set<string>();
  for (const shape of Object.values(page.objects)) {
    if (shape.type !== 'text') continue;
    const content = (shape as Shape & { content?: { children?: unknown[] } }).content;
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const n = node as { fontFamily?: string; children?: unknown[] };
      if (typeof n.fontFamily === 'string' && n.fontFamily) {
        fontSet.add(normaliseFontFamily(n.fontFamily));
      }
      if (Array.isArray(n.children)) n.children.forEach(walk);
    };
    walk(content);
  }

  const result: PageOverview = {
    pageName: page.name,
    pageId,
    fileId,
    totalShapes: Math.max(0, Object.keys(page.objects).length - (root ? 1 : 0)),
    typeCounts,
    commonNames,
    fontsUsed: Array.from(fontSet).filter(Boolean).sort(),
    tokenSummary,
  };

  if (options.includeTree !== false) {
    const maxDepth = Math.max(0, Math.min(options.maxDepth ?? DEFAULT_TREE_DEPTH, 8));
    const maxNodes = Math.max(1, Math.min(options.maxNodes ?? DEFAULT_TREE_MAX_NODES, 2000));
    const state: TreeBuildState = {
      returnedNodes: 0,
      truncatedByDepth: false,
      truncatedByNodeLimit: false,
    };
    const tree: PageTreeNode = {
      id: pageId,
      name: page.name,
      type: 'page',
      childCount: rootChildIds.length,
      descendantCount: result.totalShapes,
    };
    if (rootChildIds.length > 0) {
      if (maxDepth === 0) {
        tree.childrenOmitted = rootChildIds.length;
        state.truncatedByDepth = true;
      } else {
        const children: PageTreeNode[] = [];
        for (const childId of rootChildIds) {
          const child = buildTreeNode(page.objects, childId, 1, maxDepth, maxNodes, state);
          if (child) children.push(child);
          else if (state.returnedNodes >= maxNodes) break;
        }
        if (children.length > 0) tree.children = children;
        if (children.length < rootChildIds.length) {
          tree.childrenOmitted = rootChildIds.length - children.length;
          state.truncatedByNodeLimit = true;
        }
      }
    }
    result.tree = tree;
    result.treeMeta = {
      maxDepth,
      maxNodes,
      returnedNodes: state.returnedNodes,
      totalNodes: result.totalShapes,
      truncated: state.returnedNodes < result.totalShapes,
      truncatedByDepth: state.truncatedByDepth,
      truncatedByNodeLimit: state.truncatedByNodeLimit,
    };
  }

  const query = options.query?.trim();
  const queryFields: OverviewQueryField[] = options.queryFields?.length
    ? [...new Set(options.queryFields)]
    : ['name', 'text'];
  const types = options.types?.length ? [...new Set(options.types)] : undefined;
  const searchRequested = !!query || !!types || !!options.scopeId;
  if (!searchRequested) return result;

  if (options.scopeId && !page.objects[options.scopeId]) {
    throw new Error(
      `Overview scope ${options.scopeId} not found on page ${pageId}. Call get_page_overview without scopeId to discover valid node ids.`,
    );
  }

  const documentOrder = collectDocumentOrder(page.objects, root);
  let allowedIds: Set<string> | undefined;
  if (options.scopeId) {
    allowedIds = new Set<string>();
    const visit = (id: string): void => {
      const shape = page.objects[id];
      if (!shape || allowedIds!.has(id)) return;
      allowedIds!.add(id);
      childIds(shape).forEach(visit);
    };
    visit(options.scopeId);
  }
  const queryTerms = query?.toLocaleLowerCase().split(/\s+/).filter(Boolean) ?? [];
  const typeSet = types ? new Set<ShapeType>(types) : undefined;
  const matchedShapes = documentOrder
    .filter((id) => !allowedIds || allowedIds.has(id))
    .map((id) => page.objects[id]!)
    .filter((shape) => !typeSet || typeSet.has(shape.type))
    .filter((shape) => {
      if (queryTerms.length === 0) return true;
      const fields: Record<OverviewQueryField, string> = {
        name: shape.name,
        text: collectText(shape, Number.POSITIVE_INFINITY) ?? '',
        path: [...ancestorNames(page.objects, shape, root?.id), shape.name].join(' > '),
      };
      const haystack = queryFields
        .map((field) => fields[field])
        .join(' ')
        .toLocaleLowerCase();
      return queryTerms.every((term) => haystack.includes(term));
    });
  const maxResults = Math.max(1, Math.min(options.maxResults ?? 50, 200));
  const matches = matchedShapes
    .slice(0, maxResults)
    .map((shape) => buildMatch(page.objects, shape, root?.id));
  result.search = {
    ...(query ? { query } : {}),
    ...(query ? { queryFields } : {}),
    ...(types ? { types } : {}),
    ...(options.scopeId ? { scopeId: options.scopeId } : {}),
    matched: matchedShapes.length,
    returned: matches.length,
    truncated: matchedShapes.length > matches.length,
  };
  result.matches = matches;
  return result;
}

export async function getPageOverview(
  token: string,
  fileId: string,
  pageId: string,
  options: OverviewOptions = {},
): Promise<PageOverview> {
  const page = await fetchPage(token, fileId, pageId);
  return buildPageOverview(page, fileId, pageId, options);
}
