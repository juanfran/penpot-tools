import { threadsInScope, type DesignCommentThread } from '@penpot-tools/converter/comments';
import { useMemo } from 'react';

import { CommentText, formatCommentDate, ThreadNumber } from '#/components/comments/thread-card';

/**
 * Comment threads pinned on the selected shape or its descendants (plus
 * canvas pins right next to it when it's a top-level board). Clicking one
 * opens its card on the canvas. Hidden when there are none.
 */
export function CommentsSection({
  threads,
  shapeId,
  activeThreadId,
  onOpenThread,
}: {
  threads: readonly DesignCommentThread[];
  shapeId: string;
  activeThreadId?: string;
  onOpenThread: (thread: DesignCommentThread) => void;
}) {
  const scoped = useMemo(() => threadsInScope(threads, shapeId), [threads, shapeId]);
  if (scoped.length === 0) return null;

  return (
    <div className="border-t border-gray-100 px-4 pt-3 pb-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
          Comments
        </span>
        <span className="font-mono text-[10px] text-gray-400">{scoped.length}</span>
      </div>
      <ul className="space-y-1">
        {scoped.map((thread) => {
          const first = thread.comments[0];
          const replies = thread.commentCount - 1;
          const active = thread.id === activeThreadId;
          return (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => onOpenThread(thread)}
                className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                  active ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                title="Show on canvas"
              >
                <ThreadNumber thread={thread} active={active} />
                <span className="min-w-0 flex-1">
                  {first && (
                    <CommentText
                      comment={first}
                      className="line-clamp-3 text-xs leading-snug text-gray-800"
                    />
                  )}
                  <span className="mt-0.5 block truncate text-[10px] text-gray-400">
                    {first?.author}
                    {first && ` · ${formatCommentDate(first.createdAt)}`}
                    {replies > 0 && ` · ${replies} ${replies === 1 ? 'reply' : 'replies'}`}
                    {thread.resolved && ' · resolved'}
                    {thread.anchor.shapeId && thread.anchor.shapeId !== shapeId && (
                      <> · on {thread.anchor.shapeName}</>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
