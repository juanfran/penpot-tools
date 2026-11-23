import type { DesignCommentThread } from '@penpot-tools/converter/comments';
import { describe, expect, it } from 'vitest';
import { visibleThreads } from './comment-pins';

const t = (id: string, resolved: boolean) => ({ id, resolved }) as DesignCommentThread;
const threads = [t('open', false), t('done', true)];

describe('visibleThreads', () => {
  it('filters by the visibility preference', () => {
    expect(visibleThreads(threads, 'all', undefined).map((x) => x.id)).toEqual(['open', 'done']);
    expect(visibleThreads(threads, 'open', undefined).map((x) => x.id)).toEqual(['open']);
    expect(visibleThreads(threads, 'hidden', undefined)).toEqual([]);
  });

  it('always keeps the open thread, even when pins are hidden or it is resolved', () => {
    expect(visibleThreads(threads, 'hidden', 'done').map((x) => x.id)).toEqual(['done']);
    expect(visibleThreads(threads, 'open', 'done').map((x) => x.id)).toEqual(['open', 'done']);
  });
});
