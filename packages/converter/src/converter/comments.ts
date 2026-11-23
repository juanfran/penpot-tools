/**
 * Design comments: Penpot comment threads, mapped onto the layers they sit on.
 *
 * Penpot pins a thread to a canvas point (`position`) — it does not link it to
 * a layer, and the stored `frameId` is only the board under the pin at
 * creation time (frequently the root). So we hit-test the point against the
 * page tree ourselves: the anchor is the topmost visible shape under the pin,
 * which is what the designer was pointing at when they clicked.
 *
 * Pure: callers fetch the threads (`get-comment-threads`) and replies
 * (`get-comments`) with their own transport and hand them in as
 * `PageCommentData`. Shared by the MCP (`get_html` / `get_comments`) and the
 * viewer (comment pins on the canvas).
 */
import type { Comment, CommentThread, GeomPoint, Page, Shape } from '../penpot.types';

export interface DesignComment {
  author: string;
  createdAt: string;
  /** Cleaned body (see `cleanCommentText`); mentions read `@Full Name`. */
  text: string;
  /** Names mentioned in `text` (without the `@`), in order of appearance. */
  mentions?: string[];
}

export interface NearBoard {
  id: string;
  name: string;
  /** Distance in px from the pin to the board's bounds. */
  distance: number;
}

export interface CommentAnchor {
  /** `shape` — the pin sits over a layer; `canvas` — over empty canvas. */
  kind: 'shape' | 'canvas';
  shapeId?: string;
  shapeName?: string;
  shapeType?: string;
  /** Name breadcrumb from the top-level board down to the anchor. */
  path?: string;
  /** Ids matching `path`: top-level board first, anchor last. */
  ancestorIds?: string[];
  /** Visible text inside the anchor (truncated) — tells apart elements sharing a class. */
  text?: string;
  /** Top-level board containing the anchor. */
  boardId?: string;
  /**
   * Canvas pins only: top-level boards whose edge is within
   * `NEAR_BOARD_MARGIN` px of the pin, closest first. Designers often pin a
   * note just above a board (next to its title) rather than on it.
   */
  nearBoards?: NearBoard[];
}

export interface DesignCommentThread {
  id: string;
  seqn: number;
  resolved: boolean;
  /** Pin position in page coordinates (rounded). */
  position: { x: number; y: number };
  createdAt: string;
  anchor: CommentAnchor;
  /** Total comments in the thread (first comment + replies). */
  commentCount: number;
  /** Thread comments, oldest first. Only the first one when replies weren't fetched. */
  comments: DesignComment[];
}

export interface PageCommentData {
  /** Threads of ONE page. */
  threads: CommentThread[];
  /** Replies keyed by thread id — only for threads with more than one comment. */
  commentsByThread: Map<string, Comment[]>;
}

const ROOT_ID = '00000000-0000-0000-0000-000000000000';
/** A backmost background-like leaf covering at least this share of its parent's
 *  area is treated as the parent's background; the anchor moves to the parent. */
const BACKGROUND_AREA_RATIO = 0.9;
/** Leaf types that can act as a parent's background (never text). */
const BACKGROUND_TYPES = new Set<Shape['type']>(['rect', 'image', 'path', 'svg-raw', 'bool']);
/** How far outside a top-level board a canvas pin still counts as "about" it. */
const NEAR_BOARD_MARGIN = 200;
const ANCHOR_TEXT_CHARS = 60;
const DEFAULT_REPLY_CONCURRENCY = 6;
/** Zero-width space / non-joiner / joiner and BOM — Penpot's editor wraps mentions in them. */
const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g;
const MENTION_RE = /@\[([^\]]+)\]\([0-9a-f-]+\)/gi;

/**
 * Normalise a Penpot comment body: `@[Full Name](uuid)` → `@Full Name`, strip
 * the zero-width characters Penpot's editor inserts around mentions, trim.
 */
export function cleanCommentText(raw: string): string {
  return raw
    .replace(MENTION_RE, '@$1')
    .replace(ZERO_WIDTH_RE, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/** Names mentioned in a raw Penpot comment body (`@[Full Name](uuid)`). */
export function commentMentions(raw: string): string[] {
  return [...raw.matchAll(MENTION_RE)].map((m) => m[1]!);
}

function toDesignComment(author: unknown, createdAt: unknown, raw: unknown): DesignComment {
  const body = typeof raw === 'string' ? raw : '';
  const comment: DesignComment = {
    author: typeof author === 'string' && author ? author : 'Unknown',
    createdAt: typeof createdAt === 'string' ? createdAt : '',
    text: cleanCommentText(body),
  };
  const mentions = commentMentions(body);
  if (mentions.length > 0) comment.mentions = mentions;
  return comment;
}

/** A thread's comments (`get-comments`) as display-ready entries, oldest first. */
export function repliesToDesignComments(replies: readonly Comment[]): DesignComment[] {
  return [...replies]
    .sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')))
    .map((c) => toDesignComment(c.ownerFullname, c.createdAt, c.content));
}

// ---------------------------------------------------------------------------
// Fetching (transport-agnostic)
// ---------------------------------------------------------------------------

/** The two RPCs comments need, over whatever HTTP client the caller uses. */
export interface CommentTransport {
  /** `get-comment-threads` for a whole file. */
  getThreads(fileId: string): Promise<CommentThread[]>;
  /** `get-comments` for one thread (every comment, the first one included). */
  getComments(threadId: string): Promise<Comment[]>;
}

export class CommentsTimeoutError extends Error {
  constructor(what: string, ms: number) {
    super(`${what} timed out after ${ms}ms`);
    this.name = 'CommentsTimeoutError';
  }
}

/** Reject with `CommentsTimeoutError` when `promise` takes longer than `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new CommentsTimeoutError(what, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Threads of one page (resolved included unless `includeResolved === false`). */
export async function fetchPageThreads(
  transport: CommentTransport,
  fileId: string,
  pageId: string,
  options: { includeResolved?: boolean } = {},
): Promise<CommentThread[]> {
  const all = await transport.getThreads(fileId);
  return all.filter(
    (t) => t.pageId === pageId && (options.includeResolved !== false || !t.isResolved),
  );
}

/** Threads whose replies must be fetched (`get-comments`) to show the whole conversation. */
export function threadsNeedingReplies<T extends { commentCount?: number; countComments?: number }>(
  threads: readonly T[],
): T[] {
  return threads.filter((t) => (t.countComments ?? t.commentCount ?? 1) > 1);
}

/**
 * Replies of each given thread, a few requests at a time. Best effort: a
 * thread whose request fails (deleted meanwhile, 5xx…) is simply missing from
 * the map — callers keep showing its first comment — and the whole batch is
 * abandoned after `timeoutMs`, keeping whatever already arrived.
 */
export async function fetchReplies(
  transport: CommentTransport,
  threadIds: readonly string[],
  options: { concurrency?: number; timeoutMs?: number } = {},
): Promise<Map<string, Comment[]>> {
  const out = new Map<string, Comment[]>();
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_REPLY_CONCURRENCY);
  const run = async () => {
    for (let i = 0; i < threadIds.length; i += concurrency) {
      const batch = threadIds.slice(i, i + concurrency);
      const results = await Promise.allSettled(batch.map((id) => transport.getComments(id)));
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) out.set(batch[idx]!, r.value);
      });
    }
  };
  if (options.timeoutMs === undefined) await run();
  else await withTimeout(run(), options.timeoutMs, 'Comment replies').catch(() => {});
  return out;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

function childIds(shape: Shape): string[] {
  return 'shapes' in shape && Array.isArray(shape.shapes) ? shape.shapes : [];
}

function findRoot(objects: Record<string, Shape>): Shape | undefined {
  return objects[ROOT_ID] ?? Object.values(objects).find((s) => s.parentId === s.id);
}

function isFinitePoint(p: unknown): p is GeomPoint {
  const q = p as GeomPoint | null | undefined;
  return !!q && Number.isFinite(q.x) && Number.isFinite(q.y);
}

/**
 * Children of `shape`, back-to-front (last = painted on top), the way Penpot
 * renders them. Plain frames and groups paint in `shapes` order. Layout
 * boards (flex and grid) sort by `layoutItemZIndex` first and, within the same
 * z-index, paint the array in reverse — except `row-reverse` /
 * `column-reverse` flex, which keeps array order. Mirrors Penpot's
 * `sort-layout-children-z-index` (common/types/shape/layout.cljc).
 */
export function childrenInPaintOrder(objects: Record<string, Shape>, shape: Shape): string[] {
  const ids = childIds(shape);
  if (shape.type !== 'frame' || !shape.layoutType) return ids;
  const keepArrayOrder =
    shape.layoutType === 'flex' &&
    (shape.layoutFlexDir === 'row-reverse' || shape.layoutFlexDir === 'column-reverse');
  return ids
    .map((id, idx) => ({ id, idx, z: objects[id]?.layoutItemZIndex ?? 0 }))
    .sort((a, b) => a.z - b.z || (keepArrayOrder ? a.idx - b.idx : b.idx - a.idx))
    .map((c) => c.id);
}

/**
 * Point in the shape's own (possibly rotated / flipped) box, as fractions:
 * (0,0) is the first corner, (1,1) the opposite one. Uses the four `points`
 * corners Penpot stores in page coordinates, falling back to `selrect`.
 */
function localCoords(shape: Shape, p: GeomPoint): { s: number; t: number } | null {
  const pts = shape.points;
  if (Array.isArray(pts) && pts.length === 4 && pts.every(isFinitePoint)) {
    const [p0, p1, , p3] = pts as [GeomPoint, GeomPoint, GeomPoint, GeomPoint];
    const u = { x: p1.x - p0.x, y: p1.y - p0.y };
    const v = { x: p3.x - p0.x, y: p3.y - p0.y };
    const det = u.x * v.y - u.y * v.x;
    if (Math.abs(det) > 1e-9) {
      const d = { x: p.x - p0.x, y: p.y - p0.y };
      return { s: (d.x * v.y - d.y * v.x) / det, t: (u.x * d.y - u.y * d.x) / det };
    }
  }
  const r = shape.selrect;
  if (!r || !(r.width > 0) || !(r.height > 0)) return null;
  return { s: (p.x - r.x) / r.width, t: (p.y - r.y) / r.height };
}

function inSelrect(shape: Shape, p: GeomPoint): boolean {
  const r = shape.selrect;
  if (!r) return false;
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

function containsPoint(shape: Shape, p: GeomPoint): boolean {
  const local = localCoords(shape, p);
  // Degenerate boxes (straight lines, zero-size shapes): plain bounds test.
  if (!local) return inSelrect(shape, p);
  const { s, t } = local;
  if (s < 0 || s > 1 || t < 0 || t > 1) return false;
  // Ellipses don't cover their bounding-box corners.
  if (shape.type === 'circle') return (s - 0.5) ** 2 + (t - 0.5) ** 2 <= 0.25;
  return true;
}

function clipsContent(shape: Shape): boolean {
  // Mirrors the frame renderer's `overflow: hidden` rule.
  return shape.type === 'frame' && shape.clipContent !== false && !shape.showContent;
}

function isInvisible(shape: Shape): boolean {
  return !!shape.hidden || shape.opacity === 0;
}

function area(shape: Shape): number {
  return Math.max(0, shape.selrect?.width ?? 0) * Math.max(0, shape.selrect?.height ?? 0);
}

/**
 * Topmost visible shape under `point`, i.e. what the designer was looking at
 * when they dropped the pin. Walks the tree in Penpot's paint order (see
 * `childrenInPaintOrder`) and keeps the last hit:
 * - hidden and fully transparent subtrees are skipped;
 * - clipped boards hide their children outside their bounds, and a masked
 *   group shows its children only inside its mask (the mask itself is never
 *   an anchor);
 * - groups paint nothing of their own, so the gaps between their children
 *   fall through to whatever is underneath;
 * - bool operands aren't hit individually — the bool is the visible shape;
 * - ellipses and rotated shapes use their real outline, not the bounding box.
 *
 * A backmost, background-like leaf (rect / image / path…, never text) covering
 * ≥90% of its parent is promoted to the parent: a pin on a card's empty
 * padding is about the card, not its background rectangle.
 */
export function findAnchorShape(
  objects: Record<string, Shape>,
  point: GeomPoint,
): Shape | undefined {
  const root = findRoot(objects);
  if (!root || !isFinitePoint(point)) return undefined;
  let hit: Shape | undefined;
  const seen = new Set<string>([root.id]);
  const visit = (id: string): void => {
    if (seen.has(id)) return;
    seen.add(id);
    const shape = objects[id];
    if (!shape || isInvisible(shape)) return;

    if (shape.type === 'group' && shape.maskedGroup) {
      const [maskId, ...content] = childIds(shape);
      const mask = maskId ? objects[maskId] : undefined;
      if (maskId) seen.add(maskId);
      if (!mask || !containsPoint(mask, point)) return;
      content.forEach(visit);
      return;
    }

    const inside = containsPoint(shape, point);
    if (inside && shape.type !== 'group') hit = shape;
    if (shape.type === 'bool') return;
    if (!inside && clipsContent(shape)) return;
    childrenInPaintOrder(objects, shape).forEach(visit);
  };
  childrenInPaintOrder(objects, root).forEach(visit);

  if (hit && childIds(hit).length === 0 && BACKGROUND_TYPES.has(hit.type)) {
    const parent = objects[hit.parentId];
    if (parent && parent.id !== root.id && (parent.type === 'frame' || parent.type === 'group')) {
      const backmost = childrenInPaintOrder(objects, parent).find(
        (id) => objects[id] && !isInvisible(objects[id]!),
      );
      const parentArea = area(parent);
      if (
        backmost === hit.id &&
        parentArea > 0 &&
        area(hit) / parentArea >= BACKGROUND_AREA_RATIO
      ) {
        hit = parent;
      }
    }
  }
  return hit;
}

/** Visible top-level boards within `NEAR_BOARD_MARGIN` of a canvas pin, closest first. */
export function findNearBoards(objects: Record<string, Shape>, point: GeomPoint): NearBoard[] {
  const root = findRoot(objects);
  if (!root || !isFinitePoint(point)) return [];
  return childIds(root)
    .map((id) => objects[id])
    .filter((s): s is Shape => !!s && s.type === 'frame' && !isInvisible(s) && !!s.selrect)
    .map((s) => {
      const r = s.selrect;
      const dx = Math.max(r.x - point.x, 0, point.x - (r.x + r.width));
      const dy = Math.max(r.y - point.y, 0, point.y - (r.y + r.height));
      return { id: s.id, name: s.name, distance: Math.round(Math.hypot(dx, dy)) };
    })
    .filter((b) => b.distance <= NEAR_BOARD_MARGIN)
    .sort((a, b) => a.distance - b.distance);
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
    if (!s || isInvisible(s) || seen.has(s.id)) return;
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

function anchorFor(
  objects: Record<string, Shape>,
  rootId: string,
  point: GeomPoint,
): CommentAnchor {
  const shape = findAnchorShape(objects, point);
  if (!shape) {
    const nearBoards = findNearBoards(objects, point);
    return nearBoards.length > 0 ? { kind: 'canvas', nearBoards } : { kind: 'canvas' };
  }
  const chain = ancestry(objects, shape, rootId);
  const anchor: CommentAnchor = {
    kind: 'shape',
    shapeId: shape.id,
    shapeName: shape.name,
    shapeType: shape.type,
    path: chain.map((s) => s.name).join(' > '),
    ancestorIds: chain.map((s) => s.id),
    boardId: chain[0]!.id,
  };
  const text = subtreeText(objects, shape);
  if (text) anchor.text = text;
  return anchor;
}

/**
 * Resolve every thread to the layer it sits on. Sorted by thread number.
 * Malformed threads (no usable position or id) are skipped rather than
 * failing the whole list: comments ride along with other tools' output.
 */
export function anchorThreads(page: Page, data: PageCommentData): DesignCommentThread[] {
  const root = findRoot(page.objects);
  const rootId = root?.id ?? ROOT_ID;
  const out: DesignCommentThread[] = [];
  for (const thread of data.threads) {
    if (!thread || typeof thread.id !== 'string' || !isFinitePoint(thread.position)) continue;
    const replies = data.commentsByThread.get(thread.id);
    out.push({
      id: thread.id,
      seqn: Number.isFinite(thread.seqn) ? thread.seqn : 0,
      resolved: !!thread.isResolved,
      position: { x: Math.round(thread.position.x), y: Math.round(thread.position.y) },
      createdAt: typeof thread.createdAt === 'string' ? thread.createdAt : '',
      anchor: anchorFor(page.objects, rootId, thread.position),
      commentCount: Math.max(1, thread.countComments ?? 1, replies?.length ?? 0),
      comments:
        replies && replies.length > 0
          ? repliesToDesignComments(replies)
          : [toDesignComment(thread.ownerFullname, thread.createdAt, thread.content)],
    });
  }
  return out.sort((a, b) => a.seqn - b.seqn);
}

/** Swap in the full conversation for threads whose replies were fetched later. */
export function attachReplies(
  threads: readonly DesignCommentThread[],
  commentsByThread: ReadonlyMap<string, Comment[]>,
): DesignCommentThread[] {
  return threads.map((t) => {
    const replies = commentsByThread.get(t.id);
    if (!replies || replies.length === 0) return t;
    return {
      ...t,
      commentCount: Math.max(t.commentCount, replies.length),
      comments: repliesToDesignComments(replies),
    };
  });
}

/**
 * Shapes a thread "belongs to": its anchor and every ancestor up to the
 * top-level board, or — for canvas pins — the boards right next to it.
 */
function relatedShapeIds(thread: DesignCommentThread): string[] {
  return thread.anchor.ancestorIds ?? thread.anchor.nearBoards?.map((b) => b.id) ?? [];
}

/**
 * Threads anchored on `scopeId` or any of its descendants, plus canvas pins
 * next to it when `scopeId` is a top-level board (see `nearBoards`). The page
 * root (`00000000-…`) scopes to every thread on the page.
 */
export function threadsInScope(
  threads: readonly DesignCommentThread[],
  scopeId: string,
): DesignCommentThread[] {
  if (scopeId === ROOT_ID) return [...threads];
  return threads.filter((t) => relatedShapeIds(t).includes(scopeId));
}

/**
 * Thread count per shape, counting every thread anchored on it or below it.
 * Canvas pins count towards every top-level board they sit next to.
 */
export function commentCountsBySubtree(
  threads: readonly DesignCommentThread[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of threads) {
    for (const id of relatedShapeIds(t)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}
