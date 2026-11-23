/**
 * Design comments for the MCP: fetch a page's threads over the RPC API and
 * resolve them into anchored, scoped threads. The geometry (which layer each
 * pin sits on) is shared with the viewer — see `@penpot-tools/converter/comments`.
 *
 * Comments are supplementary: every entry point here settles instead of
 * throwing, and every network step has a deadline, so a slow or broken
 * comments API never blocks or breaks the tool the comments ride along with.
 */
import {
  anchorThreads,
  attachReplies,
  fetchPageThreads,
  fetchReplies,
  threadsInScope,
  threadsNeedingReplies,
  withTimeout,
  type CommentTransport,
  type DesignCommentThread,
} from '@penpot-tools/converter/comments';
import type { CommentThread, Page } from '@penpot-tools/converter/types';
import { fetchComments, fetchCommentThreads } from './penpot-api.ts';

const THREADS_TIMEOUT_MS = 10_000;
const REPLIES_TIMEOUT_MS = 10_000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function transport(token: string): CommentTransport {
  return {
    getThreads: (fileId) => fetchCommentThreads(token, fileId),
    getComments: (threadId) => fetchComments(token, threadId),
  };
}

export type ThreadsResult = { threads: CommentThread[] } | { error: string };

/**
 * Raw threads of one page. Doesn't need the page itself, so callers start it
 * alongside `get-page`. Never rejects.
 */
export function loadPageThreads(
  token: string,
  fileId: string,
  pageId: string,
  options: { includeResolved?: boolean } = {},
): Promise<ThreadsResult> {
  return withTimeout(
    fetchPageThreads(transport(token), fileId, pageId, options),
    THREADS_TIMEOUT_MS,
    'Loading comment threads',
  ).then(
    (threads) => ({ threads }),
    (error: unknown) => ({ error: errorMessage(error) }),
  );
}

export type DesignCommentsResult = { threads: DesignCommentThread[] } | { error: string };

/**
 * Anchor the loaded threads on `page`, keep the ones in `scopeId` (all when
 * omitted), then fetch replies for those threads only. A reply request that
 * fails or runs past its deadline just leaves that thread with its first
 * comment. Never rejects.
 */
export async function resolveDesignComments(
  token: string,
  page: Page,
  loaded: ThreadsResult,
  options: { scopeId?: string; withReplies?: boolean } = {},
): Promise<DesignCommentsResult> {
  if ('error' in loaded) return loaded;
  try {
    const anchored = anchorThreads(page, { threads: loaded.threads, commentsByThread: new Map() });
    const scoped = options.scopeId ? threadsInScope(anchored, options.scopeId) : anchored;
    if (options.withReplies === false) return { threads: scoped };
    const replies = await fetchReplies(
      transport(token),
      threadsNeedingReplies(scoped).map((t) => t.id),
      { timeoutMs: REPLIES_TIMEOUT_MS },
    );
    return { threads: attachReplies(scoped, replies) };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
