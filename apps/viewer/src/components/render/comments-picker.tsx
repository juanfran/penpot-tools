import type { DesignCommentThread } from '@penpot-tools/converter/comments';
import { MessageSquare, MessageSquareOff, TriangleAlert } from 'lucide-react';

import {
  COMMENT_VISIBILITIES,
  type CommentVisibility,
  useCommentsPrefs,
} from '#/components/comments/comments-prefs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select';

const LABELS: Record<CommentVisibility, string> = {
  all: 'All comments',
  open: 'Open only',
  hidden: 'Hide comments',
};

function isVisibility(value: unknown): value is CommentVisibility {
  return COMMENT_VISIBILITIES.includes(value as CommentVisibility);
}

/** Canvas toolbar control: which comment pins to show. */
export function CommentsPicker({
  threads,
  error,
}: {
  threads: readonly DesignCommentThread[];
  error?: string;
}) {
  const visibility = useCommentsPrefs((s) => s.visibility);
  const setVisibility = useCommentsPrefs((s) => s.setVisibility);
  const open = threads.filter((t) => !t.resolved).length;
  const counts: Record<CommentVisibility, number | null> = {
    all: threads.length,
    open,
    hidden: null,
  };
  const Icon = error ? TriangleAlert : visibility === 'hidden' ? MessageSquareOff : MessageSquare;

  return (
    <Select
      value={visibility}
      onValueChange={(next) => {
        if (isVisibility(next)) setVisibility(next);
      }}
    >
      <SelectTrigger
        className="h-8 border-white/10 bg-black/60 px-2.5 text-xs text-white shadow-xl backdrop-blur-sm hover:bg-black/70"
        title={error ? `Comments could not be loaded: ${error}` : 'Comment pins'}
        aria-label="Comment pins"
      >
        <Icon className={error ? 'size-3.5 text-amber-400' : 'size-3.5 text-white/70'} />
        <SelectValue>
          {error
            ? 'Comments unavailable'
            : `${threads.length} comment${threads.length === 1 ? '' : 's'}`}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end" alignItemWithTrigger={false} className="min-w-44">
        {COMMENT_VISIBILITIES.map((value) => (
          <SelectItem key={value} value={value}>
            <span className="flex w-full items-center justify-between gap-3">
              {LABELS[value]}
              {counts[value] !== null && (
                <span className="font-mono text-[10px] text-gray-400">{counts[value]}</span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
