/**
 * Design comments: Penpot comment threads, mapped onto the layers they sit on.
 *
 * Penpot pins a thread to a canvas point (`position`) — it does not link it to
 * a layer, and the stored `frameId` is only the board under the pin at
 * creation time (frequently the root). So we hit-test the point against the
 * page tree ourselves: the anchor is the topmost visible shape under the pin,
 * which is what the designer was pointing at when they clicked.
 *
 * Split in two halves so the geometry is unit-testable without the network:
 * - `fetchPageCommentData` — RPC calls (threads + replies), no page needed.
 * - `anchorThreads` / `threadsInScope` / `commentCountsBySubtree` — pure.
 */
import type { Comment, CommentThread, GeomPoint, Page, Shape } from '@penpot-tools/converter/types';
import { fetchComments, fetchCommentThreads } from './penpot-api.ts';

export interface DesignComment {
  author: string;
  createdAt: string;
  text: string;
}

export interface CommentAnchor {
  /** `shape` — the pin sits over a layer; `canvas` — over empty canvas. */
  kind: 'shape' | 'canvas';
  shapeId?: string;
  shapeName?: string;
  shapeType?: string;
  /** Name breadcrumb from the top-level board down to the anchor. */
  path?: string;
  /** Visible text inside the anchor (truncated) — tells apart elements sharing a class. */
  text?: string;
  /** Top-level board containing the anchor — handy for a follow-up `get_html`. */
  boardId?: string;
  /**
   * Canvas pins only: top-level boards whose edge is within
   * `NEAR_BOARD_MARGIN` px of the pin, closest first. Designers often pin a
   * note just above a board (next to its title) rather than on it.
   */
  nearBoards?: NearBoard[];
}

export interface NearBoard {
  id: string;
  name: string;
  /** Distance in px from the pin to the board's bounds. */
  distance: number;
}

export interface DesignCommentThread {
  id: string;
  seqn: number;
  resolved: boolean;
  position: { x: number; y: number };
  createdAt: string;
  anchor: CommentAnchor;
  /** Total comments in the thread (first comment + replies). */
  commentCount: number;
  /** Thread comments, oldest first. Only the first one when replies weren't fetched. */
  comments: DesignComment[];
}

export interface PageCommentData {
  threads: CommentThread[];
  /** Replies keyed by thread id — only for threads with more than one comment. */
  commentsByThread: Map<string, Comment[]>;
}

const ROOT_ID = '00000000-0000-0000-0000-000000000000';
const REPLY_FETCH_CONCURRENCY = 6;
/** A leaf covering at least this share of its parent's area is treated as
 *  the parent's background, and the anchor is promoted to the parent. */
const BACKGROUND_AREA_RATIO = 0.9;
/** How far outside a top-level board a canvas pin still counts as "about" it. */
const NEAR_BOARD_MARGIN = 200;
const MAX_NEAR_BOARDS = 3;
const ANCHOR_TEXT_CHARS = 60;

/**
 * Normalise a Penpot comment body: `@[Full Name](uuid)` → `@Full Name`, strip
 * the zero-width spaces Penpot's editor inserts around mentions, trim.
 */
export function cleanCommentText(raw: string): string {
  return raw
    .replace(/@\[([^\]]+)\]\([0-9a-f-]+\)/gi, '@$1')
    .replace(/[​-‍﻿]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/**
 * Threads on one page plus the replies of every multi-comment thread. Reply
 * fetches are skipped when `withReplies` is false (the first comment already
 * travels on the thread as `content`).
 */
export async function fetchPageCommentData(
  token: string,
  fileId: string,
  pageId: string,
  options: { withReplies?: boolean; includeResolved?: boolean } = {},
): Promise<PageCommentData> {
  const all = await fetchCommentThreads(token, fileId);
  const threads = all.filter(
    (t) => t.pageId === pageId && (options.includeResolved !== false || !t.isResolved),
  );
  const commentsByThread = new Map<string, Comment[]>();
  if (options.withReplies !== false) {
    const pending = threads.filter((t) => (t.countComments ?? 1) > 1);
    for (let i = 0; i < pending.length; i += REPLY_FETCH_CONCURRENCY) {
      const batch = pending.slice(i, i + REPLY_FETCH_CONCURRENCY);
      const results = await Promise.all(batch.map((t) => fetchComments(token, t.id)));
      batch.forEach((t, idx) => commentsByThread.set(t.id, results[idx]!));
    }
  }
  return { threads, commentsByThread };
}

function childIds(shape: Shape): string[] {
  return 'shapes' in shape && Array.isArray(shape.shapes) ? shape.shapes : [];
}

function findRoot(objects: Record<string, Shape>): Shape | undefined {
  return objects[ROOT_ID] ?? Object.values(objects).find((s) => s.parentId === s.id);
}

/** Point-in-convex-quad (rotated shapes carry their 4 corners in `points`). */
function inPolygon(p: GeomPoint, poly: GeomPoint[]): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (cross === 0) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

function containsPoint(shape: Shape, p: GeomPoint): boolean {
  if (Array.isArray(shape.points) && shape.points.length === 4 && shape.rotation) {
    return inPolygon(p, shape.points);
  }
  const r = shape.selrect;
  if (!r) return false;
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

function clipsContent(shape: Shape): boolean {
  // Mirrors the converter's frame rule (`overflow: hidden` emission).
  return shape.type === 'frame' && shape.clipContent !== false && !shape.showContent;
}

function area(shape: Shape): number {
  return Math.max(0, shape.selrect?.width ?? 0) * Math.max(0, shape.selrect?.height ?? 0);
}

/**
 * Topmost visible shape under `point`. Walks the tree in paint order
 * (parents before children, `shapes` arrays back-to-front) and keeps the last
 * hit — i.e. whatever is drawn on top at that spot. Hidden subtrees are
 * skipped, clipped frames hide their children outside their bounds, and bool
 * operands are not hit individually (the bool is the visible shape).
 *
 * A full-bleed background leaf (rect/path/image covering ≥90% of its parent)
 * is promoted to its parent: a pin on a card's empty padding is about the
 * card, not its background rectangle.
 */
export function findAnchorShape(
  objects: Record<string, Shape>,
  point: GeomPoint,
): Shape | undefined {
  const root = findRoot(objects);
  if (!root) return undefined;
  let hit: Shape | undefined;
  const seen = new Set<string>([root.id]);
  const visit = (id: string): void => {
    if (seen.has(id)) return;
    seen.add(id);
    const shape = objects[id];
    if (!shape || shape.hidden) return;
    const inside = containsPoint(shape, point);
    if (inside) hit = shape;
    if (shape.type === 'bool') return;
    if (!inside && clipsContent(shape)) return;
    childIds(shape).forEach(visit);
  };
  childIds(root).forEach(visit);

  while (hit && childIds(hit).length === 0 && hit.parentId !== root.id) {
    const parent = objects[hit.parentId];
    if (!parent || parent.id === root.id) break;
    const parentArea = area(parent);
    if (parentArea === 0 || area(hit) / parentArea < BACKGROUND_AREA_RATIO) break;
    hit = parent;
  }
  return hit;
}

/** Visible top-level boards within `NEAR_BOARD_MARGIN` of a canvas pin. */
export function findNearBoards(objects: Record<string, Shape>, point: GeomPoint): NearBoard[] {
  const root = findRoot(objects);
  if (!root) return [];
  return childIds(root)
    .map((id) => objects[id])
    .filter((s): s is Shape => !!s && s.type === 'frame' && !s.hidden && !!s.selrect)
    .map((s) => {
      const r = s.selrect;
      const dx = Math.max(r.x - point.x, 0, point.x - (r.x + r.width));
      const dy = Math.max(r.y - point.y, 0, point.y - (r.y + r.height));
      return { id: s.id, name: s.name, distance: Math.round(Math.hypot(dx, dy)) };
    })
    .filter((b) => b.distance <= NEAR_BOARD_MARGIN)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_NEAR_BOARDS);
}

/** Text of every visible text layer under `shape` (inclusive), in tree order. */
function subtreeText(objects: Record<string, Shape>, shape: Shape): string | undefined {
  const out: string[] = [];
  const walkContent = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as { text?: string; children?: unknown[] };
    if (typeof n.text === 'string') out.push(n.text);
    if (Array.isArray(n.children)) n.children.forEach(walkContent);
  };
  const seen = new Set<string>();
  const visit = (s: Shape | undefined): void => {
    if (!s || s.hidden || seen.has(s.id)) return;
    seen.add(s.id);
    if (s.type === 'text') walkContent((s as { content?: unknown }).content);
    childIds(s).forEach((id) => visit(objects[id]));
  };
  visit(shape);
  const joined = out.join(' ').replace(/\s+/g, ' ').trim();
  if (!joined) return undefined;
  return joined.length > ANCHOR_TEXT_CHARS ? joined.slice(0, ANCHOR_TEXT_CHARS) + '…' : joined;
}

function ancestry(objects: Record<string, Shape>, shape: Shape, rootId: string): Shape[] {
  const chain: Shape[] = [shape];
  const seen = new Set<string>([shape.id]);
  let parentId = shape.parentId;
  while (parentId && parentId !== rootId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = objects[parentId];
    if (!parent) break;
    chain.unshift(parent);
    parentId = parent.parentId;
  }
  return chain;
}

function toDesignComments(thread: CommentThread, replies: Comment[] | undefined): DesignComment[] {
  if (replies && replies.length > 0) {
    return [...replies]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((c) => ({
        author: c.ownerFullname ?? 'Unknown',
        createdAt: c.createdAt,
        text: cleanCommentText(c.content ?? ''),
      }));
  }
  return [
    {
      author: thread.ownerFullname ?? 'Unknown',
      createdAt: thread.createdAt,
      text: cleanCommentText(thread.content ?? ''),
    },
  ];
}

/** Resolve every thread to the layer it sits on. Sorted by thread number. */
export function anchorThreads(page: Page, data: PageCommentData): DesignCommentThread[] {
  const root = findRoot(page.objects);
  const rootId = root?.id ?? ROOT_ID;
  return [...data.threads]
    .sort((a, b) => a.seqn - b.seqn)
    .map((thread) => {
      const shape = findAnchorShape(page.objects, thread.position);
      let anchor: CommentAnchor = { kind: 'canvas' };
      if (!shape) {
        const nearBoards = findNearBoards(page.objects, thread.position);
        if (nearBoards.length > 0) anchor = { kind: 'canvas', nearBoards };
      } else {
        const chain = ancestry(page.objects, shape, rootId);
        anchor = {
          kind: 'shape',
          shapeId: shape.id,
          shapeName: shape.name,
          shapeType: shape.type,
          path: chain.map((s) => s.name).join(' > '),
          boardId: chain[0]!.id,
        };
        const text = subtreeText(page.objects, shape);
        if (text) anchor.text = text;
      }
      return {
        id: thread.id,
        seqn: thread.seqn,
        resolved: !!thread.isResolved,
        position: { x: Math.round(thread.position.x), y: Math.round(thread.position.y) },
        createdAt: thread.createdAt,
        anchor,
        commentCount: thread.countComments ?? 1,
        comments: toDesignComments(thread, data.commentsByThread.get(thread.id)),
      };
    });
}

function isWithin(objects: Record<string, Shape>, shapeId: string, scopeId: string): boolean {
  const seen = new Set<string>();
  let id: string | undefined = shapeId;
  while (id && !seen.has(id)) {
    if (id === scopeId) return true;
    seen.add(id);
    const shape: Shape | undefined = objects[id];
    if (!shape || shape.parentId === shape.id) return false;
    id = shape.parentId;
  }
  return false;
}

/**
 * Threads anchored on `scopeId` or any of its descendants, plus canvas pins
 * next to it when `scopeId` is a top-level board (see `nearBoards`).
 */
export function threadsInScope(
  objects: Record<string, Shape>,
  threads: DesignCommentThread[],
  scopeId: string,
): DesignCommentThread[] {
  return threads.filter((t) =>
    t.anchor.shapeId !== undefined
      ? isWithin(objects, t.anchor.shapeId, scopeId)
      : !!t.anchor.nearBoards?.some((b) => b.id === scopeId),
  );
}

/**
 * Thread count per shape, counting every thread anchored on it or below it.
 * Canvas pins count towards the top-level boards they sit next to.
 */
export function commentCountsBySubtree(
  objects: Record<string, Shape>,
  threads: DesignCommentThread[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of threads) {
    for (const b of t.anchor.nearBoards ?? []) counts.set(b.id, (counts.get(b.id) ?? 0) + 1);
    const seen = new Set<string>();
    let id: string | undefined = t.anchor.shapeId;
    while (id && !seen.has(id)) {
      seen.add(id);
      const shape: Shape | undefined = objects[id];
      if (!shape || shape.parentId === shape.id) break;
      counts.set(id, (counts.get(id) ?? 0) + 1);
      id = shape.parentId;
    }
  }
  return counts;
}

export type CommentDataResult = { data: PageCommentData } | { error: string };

/**
 * `fetchPageCommentData` that never rejects — comments are supplementary, so
 * a failure must not break the tool they ride along with (`get_html`).
 */
export function settleCommentData(promise: Promise<PageCommentData>): Promise<CommentDataResult> {
  return promise.then(
    (data) => ({ data }),
    (error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }),
  );
}
