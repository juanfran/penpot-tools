import { convertPage, convertShape, buildPenpotFontsCss } from '@penpot-tools/converter';
import type { ConverterContext } from '@penpot-tools/converter';
import { extractTokens, extractAllTokens, tokensToCss } from '@penpot-tools/converter/tokens';
import type { TokenInfo } from '@penpot-tools/converter/tokens';
import type { Shape } from '@penpot-tools/converter/types';
import { fetchPage, getPenpotBase, imageUrlFor } from './penpot-api.ts';

export interface PageHtmlBundle {
  pageName: string;
  html: string;
  fontsCss: string;
  tokensCss: string;
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
    fontsCss: await buildPenpotFontsCss(fonts, { baseUrl: getPenpotBase() }),
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
    fontsCss: await buildPenpotFontsCss(fonts, { baseUrl: getPenpotBase() }),
    tokensCss: tokensToCss(tokens),
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
  width: number;
  height: number;
  text?: string;
  children?: OverviewNode[];
}

export interface PageOverview {
  pageName: string;
  pageId: string;
  fileId: string;
  totalShapes: number;
  topLevelBoards: OverviewNode[];
  fontsUsed: string[];
  tokenSummary: { name: string; category: string; usageCount: number }[];
}

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

const DEFAULT_OVERVIEW_DEPTH = 1;
const TEXT_PREVIEW_CHARS = 80;

function buildOverview(
  objects: Record<string, Shape>,
  id: string,
  depth: number,
  maxDepth: number,
): OverviewNode | null {
  const shape = objects[id];
  if (!shape) return null;
  const childIds: string[] =
    'shapes' in shape && Array.isArray((shape as Shape & { shapes?: unknown }).shapes)
      ? (shape as Shape & { shapes: string[] }).shapes
      : [];

  const node: OverviewNode = {
    id: shape.id,
    name: shape.name,
    type: shape.type,
    width: Math.round(shape.selrect.width),
    height: Math.round(shape.selrect.height),
  };
  const text = collectText(shape, TEXT_PREVIEW_CHARS);
  if (text) node.text = text;
  if (depth < maxDepth && childIds.length > 0) {
    const children = childIds.flatMap(
      (cid) => buildOverview(objects, cid, depth + 1, maxDepth) ?? [],
    );
    if (children.length > 0) node.children = children;
  }
  return node;
}

export interface OverviewOptions {
  /**
   * Tree depth for `topLevelBoards`. Defaults to 1 (only the boards themselves,
   * no children). Use a larger value when you need to reason about nested
   * structure.
   */
  depth?: number;
  /**
   * When true, return only counts / fonts / token summary — no `topLevelBoards`
   * tree. Cheapest possible response for "what's on this page roughly?".
   */
  summary?: boolean;
}

export async function getPageOverview(
  token: string,
  fileId: string,
  pageId: string,
  options: OverviewOptions = {},
): Promise<PageOverview> {
  const depth = Math.max(0, Math.min(options.depth ?? DEFAULT_OVERVIEW_DEPTH, 6));
  const page = await fetchPage(token, fileId, pageId);
  const root = Object.values(page.objects).find((s) => s.parentId === s.id);
  const rootChildIds: string[] =
    root && 'shapes' in root && Array.isArray((root as Shape & { shapes?: unknown }).shapes)
      ? (root as Shape & { shapes: string[] }).shapes
      : [];
  const topLevelBoards = options.summary
    ? []
    : rootChildIds.flatMap((id) => buildOverview(page.objects, id, 0, depth) ?? []);

  const tokens = extractAllTokens(page.objects);
  const tokenSummary = tokens
    .slice()
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 30)
    .map((t) => ({ name: t.name, category: t.category, usageCount: t.usageCount }));

  const fontSet = new Set<string>();
  for (const shape of Object.values(page.objects)) {
    if (shape.type !== 'text') continue;
    const content = (shape as Shape & { content?: { children?: unknown[] } }).content;
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const n = node as { fontFamily?: string; children?: unknown[] };
      if (typeof n.fontFamily === 'string' && n.fontFamily) fontSet.add(n.fontFamily);
      if (Array.isArray(n.children)) n.children.forEach(walk);
    };
    walk(content);
  }

  return {
    pageName: page.name,
    pageId,
    fileId,
    totalShapes: Object.keys(page.objects).length,
    topLevelBoards,
    fontsUsed: Array.from(fontSet).sort(),
    tokenSummary,
  };
}
