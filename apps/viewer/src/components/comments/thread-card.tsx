import type { DesignComment, DesignCommentThread } from '@penpot-tools/converter/comments';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { CircleCheck, Crosshair, Loader2, X } from 'lucide-react';
import { Fragment, useMemo, type CSSProperties, type Ref } from 'react';

import { getCommentThreadFn } from '#/lib/server/penpot-api';
import { cn } from '#/lib/utils';

/** Marks the card's close button, which receives focus when the card opens. */
export const COMMENT_CARD_CLOSE_ATTR = 'data-comment-card-close';

/** Full conversation of a thread; the page payload only carries each thread's first comment. */
export const commentThreadQueryOptions = (threadId: string) =>
  queryOptions({
    queryKey: ['comment-thread', threadId],
    queryFn: () => getCommentThreadFn({ data: { threadId } }),
    staleTime: 60_000,
  });

/** Class the canvas excludes from wheel-zoom / panning so the card scrolls normally. */
export const COMMENT_CARD_CLASS = 'comment-thread-card';

export function formatCommentDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Comment body with `@Mentions` highlighted. Plain text — never HTML. */
export function CommentText({
  comment,
  className,
}: {
  comment: DesignComment;
  className?: string;
}) {
  const parts = useMemo(() => {
    const names = [...new Set(comment.mentions ?? [])].sort((a, b) => b.length - a.length);
    if (names.length === 0) return [comment.text];
    const re = new RegExp(`(@(?:${names.map(escapeRegExp).join('|')}))`, 'g');
    return comment.text.split(re);
  }, [comment]);
  return (
    <p className={cn('break-words whitespace-pre-wrap', className)}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="font-medium text-blue-600">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </p>
  );
}

export function ThreadNumber({
  thread,
  active,
  className,
}: {
  thread: DesignCommentThread;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-full rounded-bl-none text-[11px] leading-none font-semibold tabular-nums',
        active
          ? 'bg-[#2196f3] text-white'
          : thread.resolved
            ? 'bg-white text-gray-500 ring-1 ring-gray-300'
            : 'bg-gray-900 text-white',
        className,
      )}
    >
      {thread.seqn}
    </span>
  );
}

function AnchorRow({
  thread,
  onSelectShape,
}: {
  thread: DesignCommentThread;
  onSelectShape?: (shapeId: string) => void;
}) {
  const { anchor } = thread;
  if (anchor.kind === 'shape' && anchor.shapeId) {
    const shapeId = anchor.shapeId;
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="min-w-0 flex-1 truncate" title={anchor.path}>
          On <span className="font-medium text-gray-700">{anchor.shapeName}</span>
          {anchor.path && anchor.path !== anchor.shapeName && (
            <span className="text-gray-400"> · {anchor.path}</span>
          )}
        </span>
        {onSelectShape && (
          <button
            type="button"
            onClick={() => onSelectShape(shapeId)}
            className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
            title="Select this layer"
          >
            <Crosshair size={12} />
            Select
          </button>
        )}
      </div>
    );
  }
  if (anchor.nearBoards?.length) {
    return (
      <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
        <span>Next to</span>
        {anchor.nearBoards.map((board) =>
          onSelectShape ? (
            <button
              key={board.id}
              type="button"
              onClick={() => onSelectShape(board.id)}
              className="rounded px-1 font-medium text-gray-700 transition-colors hover:bg-gray-100"
              title={`Select board (${board.distance}px away)`}
            >
              {board.name}
            </button>
          ) : (
            <span key={board.id} className="font-medium text-gray-700">
              {board.name}
            </span>
          ),
        )}
      </div>
    );
  }
  return <p className="text-xs text-gray-400">On the canvas, not over any layer</p>;
}

/**
 * Full thread: header, anchor and every comment. Threads with replies load
 * the rest of the conversation when the card mounts.
 */
export function CommentThreadCard({
  thread,
  onClose,
  onSelectShape,
  className,
  style,
  ref,
}: {
  thread: DesignCommentThread;
  onClose?: () => void;
  onSelectShape?: (shapeId: string) => void;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}) {
  const hasReplies = thread.commentCount > thread.comments.length;
  const replies = useQuery({ ...commentThreadQueryOptions(thread.id), enabled: hasReplies });
  const comments = replies.data && replies.data.length > 0 ? replies.data : thread.comments;
  const missing = Math.max(0, thread.commentCount - comments.length);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Comment thread #${thread.seqn}`}
      className={cn(
        COMMENT_CARD_CLASS,
        'flex w-80 flex-col rounded-lg bg-white text-sm text-gray-800 shadow-xl ring-1 ring-black/10',
        className,
      )}
      style={style}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose?.();
        }
      }}
    >
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
        <ThreadNumber thread={thread} />
        <span className="text-xs font-semibold text-gray-700">Thread #{thread.seqn}</span>
        {thread.resolved && (
          <span className="flex items-center gap-1 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
            <CircleCheck size={10} />
            Resolved
          </span>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            {...{ [COMMENT_CARD_CLOSE_ATTR]: '' }}
            className="ml-auto rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            title="Close"
            aria-label="Close thread"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="border-b border-gray-100 px-3 py-1.5">
        <AnchorRow thread={thread} onSelectShape={onSelectShape} />
      </div>
      <ol className="max-h-80 space-y-3 overflow-auto px-3 py-2.5">
        {comments.map((comment, i) => (
          <li key={i}>
            <div className="mb-0.5 flex items-baseline gap-2">
              <span className="truncate text-xs font-semibold text-gray-900">{comment.author}</span>
              <time dateTime={comment.createdAt} className="shrink-0 text-[10px] text-gray-400">
                {formatCommentDate(comment.createdAt)}
              </time>
            </div>
            <CommentText comment={comment} className="text-xs leading-relaxed text-gray-700" />
          </li>
        ))}
        {missing > 0 && !replies.isSuccess && (
          <li className="flex items-center gap-1.5 text-xs text-gray-400">
            {replies.isPending ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Loading {missing} more {missing === 1 ? 'reply' : 'replies'}…
              </>
            ) : (
              <>
                Couldn't load {missing} more {missing === 1 ? 'reply' : 'replies'}.
                <button
                  type="button"
                  onClick={() => void replies.refetch()}
                  className="rounded px-1 font-medium text-gray-600 hover:bg-gray-100"
                >
                  Retry
                </button>
              </>
            )}
          </li>
        )}
      </ol>
    </div>
  );
}
