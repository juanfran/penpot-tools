import {
  anchorThreads,
  fetchPageThreads,
  repliesToDesignComments,
  withTimeout,
  type CommentTransport,
  type DesignComment,
  type DesignCommentThread,
} from '@penpot-tools/converter/comments';
import type { Comment, CommentThread, Page } from '@penpot-tools/penpot-types';
import { rpc } from './penpot-api-utils.server';

/** The thread list loads alongside the (much heavier) page; never let it hold the canvas. */
const THREADS_TIMEOUT_MS = 5_000;

function transport(token: string): CommentTransport {
  return {
    getThreads: (fileId) =>
      rpc<CommentThread[]>(token, 'get-comment-threads', { params: { 'file-id': fileId } }),
    getComments: (threadId) =>
      rpc<Comment[]>(token, 'get-comments', { params: { 'thread-id': threadId } }),
  };
}

/**
 * Threads pinned on one page — first comment only; replies load on demand when
 * a thread is opened (`fetchThreadComments`). Doesn't need the page, so it runs
 * alongside `get-page`. Rejects on failure or after `THREADS_TIMEOUT_MS`.
 */
export function fetchPageThreadList(
  token: string,
  fileId: string,
  pageId: string,
): Promise<CommentThread[]> {
  return withTimeout(
    fetchPageThreads(transport(token), fileId, pageId),
    THREADS_TIMEOUT_MS,
    'Loading comment threads',
  );
}

export interface PageComments {
  threads: DesignCommentThread[];
  /** Set when the threads couldn't be loaded — the canvas still renders without them. */
  error?: string;
}

/**
 * Anchor already-requested threads onto the page. A failed or slow request
 * becomes `error` instead of failing the whole page load: comments are
 * supplementary.
 */
export async function resolvePageComments(
  page: Page,
  threads: Promise<CommentThread[]>,
): Promise<PageComments> {
  try {
    return {
      threads: anchorThreads(page, { threads: await threads, commentsByThread: new Map() }),
    };
  } catch (error) {
    console.error('Failed to load comments for page', page.id, error);
    return { threads: [], error: error instanceof Error ? error.message : String(error) };
  }
}

/** Every comment of one thread (the first one included), display-ready. */
export async function fetchThreadComments(
  token: string,
  threadId: string,
): Promise<DesignComment[]> {
  return repliesToDesignComments(await transport(token).getComments(threadId));
}
