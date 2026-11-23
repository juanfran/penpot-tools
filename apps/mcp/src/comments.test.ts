import { describe, expect, it } from 'vitest';
import type { Comment, CommentThread, Page, Shape } from '@penpot-tools/converter/types';
import {
  anchorThreads,
  cleanCommentText,
  commentCountsBySubtree,
  findAnchorShape,
  findNearBoards,
  threadsInScope,
} from './comments.ts';
import { buildPageOverview } from './convert.ts';
import { commentsSection } from './format.ts';

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
      cleanCommentText('​@[Miryam González](48fe87d0-0956-11eb-bb53-556a2f641513)​ revisa esto  '),
    ).toBe('@Miryam González revisa esto');
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

  it('uses fetched replies in chronological order', () => {
    expect(anchored[0]!.comments.map((c) => c.author)).toEqual(['Ester', 'Miryam']);
  });

  it('scopes threads to a subtree and counts them per ancestor', () => {
    expect(threadsInScope(objects, anchored, 'submit').map((t) => t.seqn)).toEqual([1]);
    expect(threadsInScope(objects, anchored, 'title')).toEqual([]);
    // Pins next to a top-level board come along with that board.
    expect(threadsInScope(objects, anchored, 'card').map((t) => t.seqn)).toEqual([1, 3]);
    const counts = commentCountsBySubtree(objects, anchored);
    expect(Object.fromEntries(counts)).toEqual({ 'submit-label': 1, submit: 1, card: 2 });
  });

  it('renders the markdown section with code classes when available', () => {
    const md = commentsSection(anchored, { classByShapeId: { 'submit-label': 'label' } });
    expect(md).toContain('## Design comments (2 open, 1 resolved)');
    expect(md).toContain(
      '- #3 · open · on the canvas next to board "Card" (30px away, id card) (at 100, -30)',
    );
    expect(md).toContain(
      '- #1 · open · on `.label` — Card > Submit > Label · text "Send" · id submit-label',
    );
    expect(md).toContain('  - **Miryam** (2026-09-23): ok, con spinner');
    expect(md).toContain('- #2 · resolved · on the canvas, not over any layer (at 2000, 2000)');
  });

  it('renders an explicit empty state and errors', () => {
    expect(commentsSection([], { scopeLabel: 'shape "Card"' })).toContain(
      '_No design comments on shape "Card"._',
    );
    expect(commentsSection([], { error: 'boom' })).toContain(
      'Could not load design comments: boom',
    );
  });

  it('feeds commentCount and previews into the page overview', () => {
    const out = buildPageOverview(page, 'file-1', 'page-1', { comments: anchored });
    expect(out.comments).toEqual([
      {
        seqn: 1,
        resolved: false,
        shapeId: 'submit-label',
        path: 'Card > Submit > Label',
        preview: 'deshabilitado hasta validar',
        commentCount: 2,
      },
      { seqn: 2, resolved: true, preview: 'comment 2', commentCount: 1 },
      { seqn: 3, resolved: false, nearBoards: ['Card'], preview: 'comment 3', commentCount: 1 },
    ]);
    expect(out.tree?.commentCount).toBe(3);
    const card = out.tree?.children?.find((n) => n.id === 'card');
    expect(card?.commentCount).toBe(2);
    expect(card?.children?.find((n) => n.id === 'title')?.commentCount).toBeUndefined();
  });
});
