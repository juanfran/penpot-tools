import { describe, expect, it } from 'vitest';
import type { Comment, CommentThread, Page, Shape } from '../penpot.types';
import {
  anchorThreads,
  attachReplies,
  childrenInPaintOrder,
  CommentsTimeoutError,
  fetchPageThreads,
  fetchReplies,
  withTimeout,
  type CommentTransport,
  cleanCommentText,
  commentCountsBySubtree,
  commentMentions,
  findAnchorShape,
  findNearBoards,
  threadsInScope,
  threadsNeedingReplies,
} from './comments';

const ROOT = '00000000-0000-0000-0000-000000000000';

function shape(
  id: string,
  name: string,
  type: Shape['type'],
  parentId: string,
  rect: [number, number, number, number],
  extra: Record<string, unknown> = {},
): Shape {
  const [x, y, width, height] = rect;
  return {
    id,
    name,
    type,
    parentId,
    frameId: parentId,
    x,
    y,
    width,
    height,
    selrect: { x, y, width, height },
    points: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    ...extra,
  } as unknown as Shape;
}

// Card board with a full-bleed background, a title, a hidden badge and a
// submit button (frame > text). A second, clipped board holds a child that
// overflows its bounds.
const objects: Record<string, Shape> = Object.fromEntries(
  [
    shape(ROOT, 'Root', 'frame', ROOT, [0, 0, 0, 0], { shapes: ['card', 'clipped'] }),
    shape('card', 'Card', 'frame', ROOT, [0, 0, 400, 300], {
      shapes: ['bg', 'title', 'submit', 'badge'],
    }),
    shape('bg', 'Background', 'rect', 'card', [0, 0, 400, 300]),
    shape('title', 'Title', 'text', 'card', [20, 20, 200, 30]),
    shape('submit', 'Submit', 'frame', 'card', [20, 200, 120, 40], { shapes: ['submit-label'] }),
    shape('submit-label', 'Label', 'text', 'submit', [30, 210, 100, 20], {
      content: { type: 'root', children: [{ type: 'paragraph', children: [{ text: 'Send' }] }] },
    }),
    shape('badge', 'Badge', 'rect', 'card', [20, 20, 50, 50], { hidden: true }),
    shape('clipped', 'Clipped', 'frame', ROOT, [600, 0, 100, 100], { shapes: ['overflow'] }),
    shape('overflow', 'Overflow', 'rect', 'clipped', [650, 60, 200, 20]),
  ].map((s) => [s.id, s]),
);

const page = { id: 'page-1', name: 'Page 1', objects } as unknown as Page;

function thread(
  seqn: number,
  x: number,
  y: number,
  extra: Partial<CommentThread> = {},
): CommentThread {
  return {
    id: `t${seqn}`,
    fileId: 'file-1',
    pageId: 'page-1',
    seqn,
    position: { x, y },
    frameId: ROOT,
    createdAt: '2026-09-22T13:10:26.300339Z',
    modifiedAt: '2026-09-22T13:10:26.300339Z',
    isResolved: false,
    ownerId: 'owner',
    ownerFullname: 'Ester',
    content: `comment ${seqn}`,
    countComments: 1,
    ...extra,
  } as unknown as CommentThread;
}

describe('cleanCommentText', () => {
  it('renders mentions as @Name and strips zero-width spaces', () => {
    expect(
      cleanCommentText(
        '\u200B@[Miryam González](48fe87d0-0956-11eb-bb53-556a2f641513)\u200B revisa esto  ',
      ),
    ).toBe('@Miryam González revisa esto');
  });
});

describe('commentMentions', () => {
  it('lists mentioned names in order', () => {
    expect(commentMentions('@[Ana Pérez](11111111-aaaa) y @[Luis](22222222-bbbb)')).toEqual([
      'Ana Pérez',
      'Luis',
    ]);
    expect(commentMentions('sin menciones')).toEqual([]);
  });
});

describe('findAnchorShape', () => {
  it('returns the topmost shape under the point', () => {
    expect(findAnchorShape(objects, { x: 50, y: 220 })?.id).toBe('submit-label');
    expect(findAnchorShape(objects, { x: 25, y: 205 })?.id).toBe('submit');
  });

  it('skips hidden shapes', () => {
    expect(findAnchorShape(objects, { x: 30, y: 30 })?.id).toBe('title');
  });

  it('promotes a full-bleed background leaf to its parent board', () => {
    expect(findAnchorShape(objects, { x: 300, y: 150 })?.id).toBe('card');
  });

  it('does not hit children outside a clipped frame', () => {
    expect(findAnchorShape(objects, { x: 800, y: 75 })).toBeUndefined();
    expect(findAnchorShape(objects, { x: 680, y: 75 })?.id).toBe('overflow');
  });

  it('honours rotated shapes through their corner points', () => {
    const rotated = {
      ...objects,
      [ROOT]: { ...objects[ROOT]!, shapes: ['diamond'] } as Shape,
      diamond: shape('diamond', 'Diamond', 'rect', ROOT, [0, 0, 100, 100], {
        rotation: 45,
        points: [
          { x: 50, y: 0 },
          { x: 100, y: 50 },
          { x: 50, y: 100 },
          { x: 0, y: 50 },
        ],
      }),
    };
    expect(findAnchorShape(rotated, { x: 50, y: 50 })?.id).toBe('diamond');
    // Inside the selrect but outside the rotated diamond.
    expect(findAnchorShape(rotated, { x: 5, y: 5 })).toBeUndefined();
  });

  it('returns undefined on empty canvas', () => {
    expect(findAnchorShape(objects, { x: 2000, y: 2000 })).toBeUndefined();
  });
});

describe('findNearBoards', () => {
  it('lists top-level boards within the margin, closest first', () => {
    // Between the card (ends at x=400) and the clipped board (starts at x=600).
    expect(findNearBoards(objects, { x: 480, y: 50 })).toEqual([
      { id: 'card', name: 'Card', distance: 80 },
      { id: 'clipped', name: 'Clipped', distance: 120 },
    ]);
    // Above the card, next to where Penpot draws the board title.
    expect(findNearBoards(objects, { x: 100, y: -30 })).toEqual([
      { id: 'card', name: 'Card', distance: 30 },
    ]);
    expect(findNearBoards(objects, { x: 2000, y: 2000 })).toEqual([]);
  });
});

describe('anchorThreads', () => {
  const replies = [
    {
      id: 'c2',
      threadId: 't1',
      ownerId: 'o2',
      ownerFullname: 'Miryam',
      createdAt: '2026-09-23T10:00:00Z',
      modifiedAt: '2026-09-23T10:00:00Z',
      content: 'ok, con spinner',
    },
    {
      id: 'c1',
      threadId: 't1',
      ownerId: 'owner',
      ownerFullname: 'Ester',
      createdAt: '2026-09-22T13:10:26Z',
      modifiedAt: '2026-09-22T13:10:26Z',
      content: 'deshabilitado hasta validar',
    },
  ] as unknown as Comment[];
  const data = {
    threads: [
      thread(2, 2000, 2000, { isResolved: true }),
      thread(1, 50, 220, { countComments: 2 }),
      thread(3, 100, -30),
    ],
    commentsByThread: new Map([['t1', replies]]),
  };
  const anchored = anchorThreads(page, data);

  it('sorts by seqn and maps each thread to its layer with a name path', () => {
    expect(anchored.map((t) => t.seqn)).toEqual([1, 2, 3]);
    expect(anchored[0]!.anchor).toEqual({
      kind: 'shape',
      shapeId: 'submit-label',
      shapeName: 'Label',
      shapeType: 'text',
      path: 'Card > Submit > Label',
      ancestorIds: ['card', 'submit', 'submit-label'],
      boardId: 'card',
      text: 'Send',
    });
    expect(anchored[1]!.anchor).toEqual({ kind: 'canvas' });
    expect(anchored[1]!.resolved).toBe(true);
    expect(anchored[2]!.anchor).toEqual({
      kind: 'canvas',
      nearBoards: [{ id: 'card', name: 'Card', distance: 30 }],
    });
  });

  it('only asks for replies on multi-comment threads', () => {
    expect(threadsNeedingReplies(data.threads).map((t) => t.seqn)).toEqual([1]);
  });

  it('uses fetched replies in chronological order', () => {
    expect(anchored[0]!.comments.map((c) => c.author)).toEqual(['Ester', 'Miryam']);
  });

  it('scopes threads to a subtree and counts them per ancestor', () => {
    expect(threadsInScope(anchored, 'submit').map((t) => t.seqn)).toEqual([1]);
    expect(threadsInScope(anchored, 'title')).toEqual([]);
    // Pins next to a top-level board come along with that board.
    expect(threadsInScope(anchored, 'card').map((t) => t.seqn)).toEqual([1, 3]);
    const counts = commentCountsBySubtree(anchored);
    expect(Object.fromEntries(counts)).toEqual({ 'submit-label': 1, submit: 1, card: 2 });
  });
});

// ---------------------------------------------------------------------------
// Review follow-ups: paint order, masks, groups, invisibility, outlines,
// background promotion, scope edge cases, robustness and fetching.
// ---------------------------------------------------------------------------

/** One-board page from a flat list (the board itself plus its descendants). */
function pageOf(...shapes: Shape[]): Record<string, Shape> {
  const topLevel = shapes.filter((s) => s.parentId === ROOT).map((s) => s.id);
  return Object.fromEntries(
    [shape(ROOT, 'Root', 'frame', ROOT, [0, 0, 0, 0], { shapes: topLevel }), ...shapes].map((s) => [
      s.id,
      s,
    ]),
  );
}

describe('childrenInPaintOrder', () => {
  const board = (extra: Record<string, unknown>) =>
    shape('b', 'Board', 'frame', ROOT, [0, 0, 100, 100], { shapes: ['x', 'y'], ...extra });
  const x = shape('x', 'X', 'rect', 'b', [0, 0, 50, 50]);
  const y = shape('y', 'Y', 'rect', 'b', [0, 0, 50, 50]);

  it('keeps array order for plain boards', () => {
    const objs = pageOf(board({}), x, y);
    expect(childrenInPaintOrder(objs, objs['b']!)).toEqual(['x', 'y']);
  });

  it('reverses flex/grid children (first in the array paints on top), like Penpot', () => {
    for (const extra of [
      { layoutType: 'flex', layoutFlexDir: 'row' },
      { layoutType: 'flex', layoutFlexDir: 'column' },
      { layoutType: 'grid' },
    ]) {
      const objs = pageOf(board(extra), x, y);
      expect(childrenInPaintOrder(objs, objs['b']!)).toEqual(['y', 'x']);
    }
  });

  it('keeps array order for reverse flex directions', () => {
    const objs = pageOf(board({ layoutType: 'flex', layoutFlexDir: 'row-reverse' }), x, y);
    expect(childrenInPaintOrder(objs, objs['b']!)).toEqual(['x', 'y']);
  });

  it('sorts layout children by z-index first', () => {
    const lifted = { ...y, layoutItemZIndex: 5 } as Shape;
    const objs = pageOf(board({ layoutType: 'flex', layoutFlexDir: 'row' }), x, lifted);
    expect(childrenInPaintOrder(objs, objs['b']!)).toEqual(['x', 'y']);
  });
});

describe('findAnchorShape — visibility and outlines', () => {
  it('anchors overlapping flex children in Penpot paint order and z-index', () => {
    const flex = shape('list', 'List', 'frame', ROOT, [0, 0, 200, 100], {
      shapes: ['badge', 'card'],
      layoutType: 'flex',
      layoutFlexDir: 'row',
    });
    const badge = shape('badge', 'Badge', 'rect', 'list', [90, 0, 20, 20]);
    const card = shape('card', 'Card', 'rect', 'list', [0, 0, 100, 100]);
    expect(findAnchorShape(pageOf(flex, badge, card), { x: 95, y: 5 })?.id).toBe('badge');
    const liftedCard = { ...card, layoutItemZIndex: 5 } as Shape;
    expect(findAnchorShape(pageOf(flex, badge, liftedCard), { x: 95, y: 5 })?.id).toBe('card');
  });

  it('clips a masked group to its mask and never anchors on the mask', () => {
    const board = shape('b', 'Board', 'frame', ROOT, [0, 0, 400, 300], {
      shapes: ['other', 'mg'],
    });
    const other = shape('other', 'Other', 'rect', 'b', [0, 200, 400, 100]);
    const mg = shape('mg', 'Avatar', 'group', 'b', [0, 0, 400, 300], {
      maskedGroup: true,
      shapes: ['mask', 'photo'],
    });
    const mask = shape('mask', 'Mask', 'circle', 'mg', [0, 0, 100, 100]);
    const photo = shape('photo', 'Photo', 'image', 'mg', [0, 0, 400, 300]);
    const objs = pageOf(board, other, mg, mask, photo);
    expect(findAnchorShape(objs, { x: 200, y: 250 })?.id).toBe('other');
    expect(findAnchorShape(objs, { x: 50, y: 50 })?.id).toBe('photo');
  });

  it('lets the gaps between a group’s children fall through', () => {
    const board = shape('b', 'Board', 'frame', ROOT, [0, 0, 300, 100], {
      shapes: ['hero', 'icons'],
    });
    const hero = shape('hero', 'Hero', 'rect', 'b', [0, 0, 300, 50]);
    const icons = shape('icons', 'Icons', 'group', 'b', [0, 0, 300, 20], {
      shapes: ['i1', 'i2'],
    });
    const i1 = shape('i1', 'I1', 'rect', 'icons', [0, 0, 20, 20]);
    const i2 = shape('i2', 'I2', 'rect', 'icons', [280, 0, 20, 20]);
    const objs = pageOf(board, hero, icons, i1, i2);
    expect(findAnchorShape(objs, { x: 150, y: 10 })?.id).toBe('hero');
    expect(findAnchorShape(objs, { x: 10, y: 10 })?.id).toBe('i1');
  });

  it('skips fully transparent subtrees', () => {
    const board = shape('b', 'Board', 'frame', ROOT, [0, 0, 300, 300], {
      shapes: ['base', 'ghost'],
    });
    const base = shape('base', 'Base', 'rect', 'b', [0, 0, 100, 100]);
    const ghost = shape('ghost', 'Ghost', 'frame', 'b', [0, 0, 100, 100], {
      opacity: 0,
      shapes: ['inner'],
    });
    const inner = shape('inner', 'Inner', 'rect', 'ghost', [0, 0, 50, 50]);
    expect(findAnchorShape(pageOf(board, base, ghost, inner), { x: 10, y: 10 })?.id).toBe('base');
  });

  it('uses the ellipse outline, not its bounding box', () => {
    const board = shape('b', 'Board', 'frame', ROOT, [0, 0, 300, 300], { shapes: ['dot'] });
    const dot = shape('dot', 'Dot', 'circle', 'b', [100, 100, 100, 100]);
    const objs = pageOf(board, dot);
    expect(findAnchorShape(objs, { x: 150, y: 150 })?.id).toBe('dot');
    expect(findAnchorShape(objs, { x: 103, y: 103 })?.id).toBe('b');
  });

  it('only promotes backmost background-like leaves, never text', () => {
    const btn = shape('btn', 'Button', 'frame', ROOT, [0, 0, 100, 40], {
      shapes: ['label'],
    });
    const label = shape('label', 'Label', 'text', 'btn', [0, 0, 100, 40]);
    expect(findAnchorShape(pageOf(btn, label), { x: 50, y: 20 })?.id).toBe('label');

    const card = shape('c', 'Card', 'frame', ROOT, [0, 0, 100, 100], {
      shapes: ['back', 'overlay'],
    });
    const back = shape('back', 'Back', 'rect', 'c', [0, 0, 10, 10]);
    const overlay = shape('overlay', 'Overlay', 'rect', 'c', [0, 0, 100, 100]);
    // Full-bleed but painted on top of another child: a real layer, not a background.
    expect(findAnchorShape(pageOf(card, back, overlay), { x: 50, y: 50 })?.id).toBe('overlay');
  });

  it('ignores points that are not finite numbers', () => {
    expect(findAnchorShape(objects, { x: Number.NaN, y: 0 })).toBeUndefined();
  });
});

describe('scope edge cases', () => {
  it('treats the page root as the whole page', () => {
    const anchored = anchorThreads(page, {
      threads: [thread(1, 50, 220), thread(2, 2000, 2000)],
      commentsByThread: new Map(),
    });
    expect(threadsInScope(anchored, ROOT).map((t) => t.seqn)).toEqual([1, 2]);
  });

  it('keeps every board within the margin of a canvas pin', () => {
    const boards = [0, 1, 2, 3].map((i) =>
      shape(`b${i}`, `B${i}`, 'frame', ROOT, [i * 120, 0, 100, 100]),
    );
    const objs = pageOf(...boards);
    expect(findNearBoards(objs, { x: 210, y: 150 }).map((b) => b.id)).toEqual([
      'b1',
      'b2',
      'b0',
      'b3',
    ]);
    const anchored = anchorThreads({ id: 'p', name: 'P', objects: objs } as unknown as Page, {
      threads: [thread(1, 210, 150)],
      commentsByThread: new Map(),
    });
    expect(Object.fromEntries(commentCountsBySubtree(anchored))).toEqual({
      b0: 1,
      b1: 1,
      b2: 1,
      b3: 1,
    });
  });
});

describe('anchorThreads robustness', () => {
  it('skips malformed threads instead of throwing', () => {
    const broken = [
      thread(1, 50, 220),
      { ...thread(2, 0, 0), position: null },
      { ...thread(3, 0, 0), position: { x: 'a', y: 1 } },
      null,
    ] as unknown as CommentThread[];
    const out = anchorThreads(page, { threads: broken, commentsByThread: new Map() });
    expect(out.map((t) => t.seqn)).toEqual([1]);
  });

  it('tolerates comments without dates or authors', () => {
    const replies = [{ id: 'c', threadId: 't1', content: 'hola' }] as unknown as Comment[];
    const [t] = anchorThreads(page, {
      threads: [thread(1, 50, 220, { countComments: 2 })],
      commentsByThread: new Map([['t1', replies]]),
    });
    expect(t!.comments).toEqual([{ author: 'Unknown', createdAt: '', text: 'hola' }]);
  });

  it('attachReplies swaps in the full conversation', () => {
    const anchored = anchorThreads(page, {
      threads: [thread(1, 50, 220, { countComments: 2 })],
      commentsByThread: new Map(),
    });
    expect(anchored[0]!.comments).toHaveLength(1);
    const replies = [
      { id: 'a', content: 'b', ownerFullname: 'B', createdAt: '2026-01-02' },
      { id: 'b', content: 'a', ownerFullname: 'A', createdAt: '2026-01-01' },
    ] as unknown as Comment[];
    const [t] = attachReplies(anchored, new Map([['t1', replies]]));
    expect(t!.comments.map((c) => c.author)).toEqual(['A', 'B']);
  });
});

describe('fetching', () => {
  const transportWith = (getComments: (id: string) => Promise<Comment[]>): CommentTransport => ({
    getThreads: async () => [
      thread(1, 0, 0),
      thread(2, 0, 0, { isResolved: true }),
      thread(3, 0, 0, { pageId: 'other-page' as CommentThread['pageId'] }),
    ],
    getComments,
  });

  it('filters threads by page and resolution', async () => {
    const t = transportWith(async () => []);
    expect((await fetchPageThreads(t, 'f', 'page-1')).map((x) => x.seqn)).toEqual([1, 2]);
    expect(
      (await fetchPageThreads(t, 'f', 'page-1', { includeResolved: false })).map((x) => x.seqn),
    ).toEqual([1]);
  });

  it('keeps successful replies when one request fails', async () => {
    const t = transportWith(async (id) => {
      if (id === 'bad') throw new Error('503');
      return [{ id: `${id}-c` }] as unknown as Comment[];
    });
    const out = await fetchReplies(t, ['ok1', 'bad', 'ok2']);
    expect([...out.keys()]).toEqual(['ok1', 'ok2']);
  });

  it('stops waiting at the deadline and keeps what already arrived', async () => {
    const t = transportWith((id) =>
      id === 'fast'
        ? Promise.resolve([] as Comment[])
        : new Promise<Comment[]>(() => {
            /* never settles */
          }),
    );
    const out = await fetchReplies(t, ['fast', 'slow'], { concurrency: 1, timeoutMs: 30 });
    expect([...out.keys()]).toEqual(['fast']);
  });

  it('withTimeout rejects slow promises with a typed error', async () => {
    await expect(withTimeout(new Promise(() => {}), 10, 'Threads')).rejects.toBeInstanceOf(
      CommentsTimeoutError,
    );
    await expect(withTimeout(Promise.resolve(1), 10, 'Threads')).resolves.toBe(1);
  });
});
