import { describe, expect, it } from 'vitest';
import type { FrameShape, RectShape, Shape, Uuid } from '@penpot-tools/converter/types';
import { detectOcclusions } from './occlusion';

const ROOT_ID = '00000000-0000-0000-0000-000000000000' as Uuid;

function makeRect(overrides: {
  id: string;
  name: string;
  parentId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fillOpacity?: number | null;
  rotation?: number;
}): RectShape {
  const fills =
    overrides.fillOpacity === null
      ? []
      : [{ fillColor: '#000000' as `#${string}`, fillOpacity: overrides.fillOpacity ?? 1 }];
  return {
    id: overrides.id as Uuid,
    name: overrides.name,
    type: 'rect',
    parentId: (overrides.parentId ?? ROOT_ID) as Uuid,
    frameId: (overrides.parentId ?? ROOT_ID) as Uuid,
    x: overrides.x,
    y: overrides.y,
    width: overrides.width,
    height: overrides.height,
    selrect: { x: overrides.x, y: overrides.y, width: overrides.width, height: overrides.height, x1: overrides.x, y1: overrides.y, x2: overrides.x + overrides.width, y2: overrides.y + overrides.height },
    points: [
      { x: overrides.x, y: overrides.y },
      { x: overrides.x + overrides.width, y: overrides.y },
      { x: overrides.x + overrides.width, y: overrides.y + overrides.height },
      { x: overrides.x, y: overrides.y + overrides.height },
    ],
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    rotation: overrides.rotation ?? 0,
    fills,
    strokes: [],
    proportionLock: false,
  } as unknown as RectShape;
}

function makeFrame(id: string, name: string, children: Uuid[]): FrameShape {
  return {
    id: id as Uuid,
    name,
    type: 'frame',
    parentId: ROOT_ID,
    frameId: ROOT_ID,
    x: 0,
    y: 0,
    width: 1000,
    height: 1000,
    selrect: { x: 0, y: 0, width: 1000, height: 1000, x1: 0, y1: 0, x2: 1000, y2: 1000 },
    points: [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ],
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    rotation: 0,
    fills: [],
    strokes: [],
    proportionLock: false,
    showContent: true,
    hideFillOnExport: false,
    shapes: children,
  } as FrameShape;
}

describe('detectOcclusions', () => {
  it('warns when a shape is fully covered by a later sibling with opaque fill', () => {
    // Real-world repro: a 62×27 photo counter at (44, 316) hidden by a
    // 177×98 price block at (0, 298). Both are children of the card.
    const root = makeFrame(ROOT_ID, 'Card', [
      'aaaa1111-0000-4000-8000-000000000001' as Uuid,
      'aaaa1111-0000-4000-8000-000000000002' as Uuid,
    ]);
    const counter = makeRect({
      id: 'aaaa1111-0000-4000-8000-000000000001',
      name: 'Photo counter',
      x: 44, y: 316, width: 62, height: 27,
    });
    const price = makeRect({
      id: 'aaaa1111-0000-4000-8000-000000000002',
      name: 'Price block',
      x: 0, y: 298, width: 177, height: 98,
    });

    const warnings = detectOcclusions([root, counter, price], ROOT_ID);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"Photo counter"');
    expect(warnings[0]).toContain('"Price block"');
  });

  it('does not warn when the later sibling only partially overlaps', () => {
    const root = makeFrame(ROOT_ID, 'Card', [
      'bbbb2222-0000-4000-8000-000000000001' as Uuid,
      'bbbb2222-0000-4000-8000-000000000002' as Uuid,
    ]);
    const a = makeRect({
      id: 'bbbb2222-0000-4000-8000-000000000001',
      name: 'A',
      x: 0, y: 0, width: 100, height: 100,
    });
    const b = makeRect({
      id: 'bbbb2222-0000-4000-8000-000000000002',
      name: 'B',
      x: 50, y: 50, width: 100, height: 100,
    });

    expect(detectOcclusions([root, a, b], ROOT_ID)).toEqual([]);
  });

  it('does not warn when the occluder has a semi-transparent fill', () => {
    const root = makeFrame(ROOT_ID, 'Card', [
      'cccc3333-0000-4000-8000-000000000001' as Uuid,
      'cccc3333-0000-4000-8000-000000000002' as Uuid,
    ]);
    const a = makeRect({
      id: 'cccc3333-0000-4000-8000-000000000001',
      name: 'Counter',
      x: 10, y: 10, width: 50, height: 20,
    });
    const overlay = makeRect({
      id: 'cccc3333-0000-4000-8000-000000000002',
      name: 'Shade',
      x: 0, y: 0, width: 100, height: 100,
      fillOpacity: 0.5,
    });

    expect(detectOcclusions([root, a, overlay], ROOT_ID)).toEqual([]);
  });

  it('does not warn when the occluder has no fill at all', () => {
    const root = makeFrame(ROOT_ID, 'Card', [
      'dddd4444-0000-4000-8000-000000000001' as Uuid,
      'dddd4444-0000-4000-8000-000000000002' as Uuid,
    ]);
    const a = makeRect({
      id: 'dddd4444-0000-4000-8000-000000000001',
      name: 'Counter',
      x: 10, y: 10, width: 50, height: 20,
    });
    const empty = makeRect({
      id: 'dddd4444-0000-4000-8000-000000000002',
      name: 'Empty wrapper',
      x: 0, y: 0, width: 100, height: 100,
      fillOpacity: null,
    });

    expect(detectOcclusions([root, a, empty], ROOT_ID)).toEqual([]);
  });

  it('does not warn when the "occluder" is an ancestor (parent painting bg first)', () => {
    // Common case: a card frame with bg, containing children. The card's own
    // bg paints first, then children on top. NOT an occlusion.
    const cardId = 'eeee5555-0000-4000-8000-000000000001' as Uuid;
    const childId = 'eeee5555-0000-4000-8000-000000000002' as Uuid;
    const card = {
      ...makeFrame(cardId, 'Card', [childId]),
      x: 0, y: 0, width: 200, height: 200,
      selrect: { x: 0, y: 0, width: 200, height: 200, x1: 0, y1: 0, x2: 200, y2: 200 },
      points: [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 200 },
        { x: 0, y: 200 },
      ],
      fills: [{ fillColor: '#FFFFFF', fillOpacity: 1 }],
    } as unknown as FrameShape;
    const child = makeRect({
      id: childId,
      name: 'Child',
      parentId: cardId,
      x: 50, y: 50, width: 50, height: 50,
    });

    // Card precedes child in DOM order. Child is descendant, so no occlusion.
    expect(detectOcclusions([card, child], ROOT_ID)).toEqual([]);
  });

  it('treats a fully-opaque gradient fill as occluding', () => {
    const root = makeFrame(ROOT_ID, 'Card', [
      'gggg7777-0000-4000-8000-000000000001' as Uuid,
      'gggg7777-0000-4000-8000-000000000002' as Uuid,
    ]);
    const a = makeRect({
      id: 'gggg7777-0000-4000-8000-000000000001',
      name: 'Counter',
      x: 10, y: 10, width: 50, height: 20,
    });
    const gradient = {
      ...makeRect({
        id: 'gggg7777-0000-4000-8000-000000000002',
        name: 'Hero',
        x: 0, y: 0, width: 100, height: 100,
        fillOpacity: null,
      }),
      fills: [
        {
          fillColorGradient: {
            type: 'linear',
            startX: 0, startY: 0, endX: 1, endY: 1, width: 1,
            stops: [
              { color: '#000000', opacity: 1, offset: 0 },
              { color: '#FFFFFF', opacity: 1, offset: 1 },
            ],
          },
        },
      ],
    } as unknown as Shape;

    const warnings = detectOcclusions([root, a, gradient], ROOT_ID);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"Counter"');
  });

  it('does not warn for a gradient fill with a transparent stop (e.g. legibility shade)', () => {
    const root = makeFrame(ROOT_ID, 'Card', [
      'hhhh8888-0000-4000-8000-000000000001' as Uuid,
      'hhhh8888-0000-4000-8000-000000000002' as Uuid,
    ]);
    const a = makeRect({
      id: 'hhhh8888-0000-4000-8000-000000000001',
      name: 'Photo',
      x: 0, y: 0, width: 100, height: 100,
    });
    const shade = {
      ...makeRect({
        id: 'hhhh8888-0000-4000-8000-000000000002',
        name: 'Shade',
        x: 0, y: 0, width: 100, height: 100,
        fillOpacity: null,
      }),
      fills: [
        {
          fillColorGradient: {
            type: 'linear',
            startX: 0, startY: 0, endX: 0, endY: 1, width: 1,
            stops: [
              { color: '#000000', opacity: 0, offset: 0 },
              { color: '#000000', opacity: 0.5, offset: 1 },
            ],
          },
        },
      ],
    } as unknown as Shape;

    expect(detectOcclusions([root, a, shade], ROOT_ID)).toEqual([]);
  });

  it('skips rotated shapes (axis-aligned bbox not reliable)', () => {
    const root = makeFrame(ROOT_ID, 'Card', [
      'ffff6666-0000-4000-8000-000000000001' as Uuid,
      'ffff6666-0000-4000-8000-000000000002' as Uuid,
    ]);
    const small = makeRect({
      id: 'ffff6666-0000-4000-8000-000000000001',
      name: 'Small',
      x: 10, y: 10, width: 50, height: 20,
      rotation: 7,
    });
    const big = makeRect({
      id: 'ffff6666-0000-4000-8000-000000000002',
      name: 'Big',
      x: 0, y: 0, width: 100, height: 100,
    });

    expect(detectOcclusions([root, small, big], ROOT_ID)).toEqual([]);
  });
});
