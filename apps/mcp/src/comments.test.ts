import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Comment, CommentThread, Page, Shape } from '@penpot-tools/converter/types';

const api = vi.hoisted(() => ({
  fetchCommentThreads: vi.fn<(token: string, fileId: string) => Promise<CommentThread[]>>(),
  fetchComments: vi.fn<(token: string, threadId: string) => Promise<Comment[]>>(),
}));
vi.mock('./penpot-api.ts', () => api);

const { loadPageThreads, resolveDesignComments } = await import('./comments.ts');

const ROOT = '00000000-0000-0000-0000-000000000000';

function shape(id: string, parentId: string, rect: [number, number, number, number], extra = {}) {
  const [x, y, width, height] = rect;
  return {
    id,
    name: id,
    type: 'frame',
    parentId,
    frameId: parentId,
    selrect: { x, y, width, height },
    points: [],
    ...extra,
  } as unknown as Shape;
}

const page = {
  id: 'page-1',
  name: 'Page',
  objects: Object.fromEntries(
    [
      shape(ROOT, ROOT, [0, 0, 0, 0], { shapes: ['a', 'b'] }),
      shape('a', ROOT, [0, 0, 100, 100]),
      shape('b', ROOT, [500, 0, 100, 100]),
    ].map((s) => [s.id, s]),
  ),
} as unknown as Page;

const thread = (seqn: number, x: number, extra: Partial<CommentThread> = {}) =>
  ({
    id: `t${seqn}`,
    pageId: 'page-1',
    seqn,
    position: { x, y: 50 },
    createdAt: '2026-01-01',
    ownerFullname: 'Ana',
    content: `first ${seqn}`,
    countComments: 2,
    isResolved: false,
    ...extra,
  }) as unknown as CommentThread;

beforeEach(() => {
  api.fetchCommentThreads.mockReset();
  api.fetchComments.mockReset();
});

describe('loadPageThreads', () => {
  it('settles API failures into an error result', async () => {
    api.fetchCommentThreads.mockRejectedValue(new Error('502'));
    expect(await loadPageThreads('tok', 'file', 'page-1')).toEqual({ error: '502' });
  });
});

describe('resolveDesignComments', () => {
  it('fetches replies only for the threads in scope', async () => {
    api.fetchComments.mockResolvedValue([
      { id: 'c1', content: 'first', ownerFullname: 'Ana', createdAt: '2026-01-01' },
      { id: 'c2', content: 'reply', ownerFullname: 'Bea', createdAt: '2026-01-02' },
    ] as unknown as Comment[]);
    const loaded = { threads: [thread(1, 50), thread(2, 550)] };
    const result = await resolveDesignComments('tok', page, loaded, { scopeId: 'a' });
    expect(api.fetchComments).toHaveBeenCalledTimes(1);
    expect(api.fetchComments).toHaveBeenCalledWith('tok', 't1');
    expect('threads' in result && result.threads.map((t) => t.comments.length)).toEqual([2]);
  });

  it('keeps the first comment when the reply request fails', async () => {
    api.fetchComments.mockRejectedValue(new Error('503'));
    const result = await resolveDesignComments('tok', page, { threads: [thread(1, 50)] });
    expect('threads' in result && result.threads[0]!.comments.map((c) => c.text)).toEqual([
      'first 1',
    ]);
  });

  it('skips malformed threads and never throws', async () => {
    const loaded = { threads: [thread(1, 50, { countComments: 1 }), { position: null }] };
    const result = await resolveDesignComments('tok', page, loaded as never);
    expect('threads' in result && result.threads.map((t) => t.seqn)).toEqual([1]);
    expect(await resolveDesignComments('tok', page, { error: 'down' })).toEqual({ error: 'down' });
  });

  it('can skip replies entirely (overview)', async () => {
    await resolveDesignComments('tok', page, { threads: [thread(1, 50)] }, { withReplies: false });
    expect(api.fetchComments).not.toHaveBeenCalled();
  });
});
