import { describe, expect, it } from 'vitest';
import type { Uuid } from '@penpot-tools/converter/types';
import type { MeasuredNode, PickedComputedStyle } from '../types';
import { buildTree } from './tree';

function style(overrides: Partial<PickedComputedStyle> = {}): PickedComputedStyle {
  return {
    display: 'block',
    position: 'static',
    transform: 'none',
    opacity: '1',
    mixBlendMode: 'normal',
    filter: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0)',
    backgroundImage: 'none',
    borderTopWidth: '0px',
    borderRightWidth: '0px',
    borderBottomWidth: '0px',
    borderLeftWidth: '0px',
    borderTopColor: 'rgb(0, 0, 0)',
    borderTopStyle: 'solid',
    borderTopLeftRadius: '0px',
    borderTopRightRadius: '0px',
    borderBottomRightRadius: '0px',
    borderBottomLeftRadius: '0px',
    boxShadow: 'none',
    flexDirection: 'row',
    justifyContent: 'normal',
    alignItems: 'normal',
    rowGap: '0px',
    columnGap: '0px',
    paddingTop: '0px',
    paddingRight: '0px',
    paddingBottom: '0px',
    paddingLeft: '0px',
    gridTemplateColumns: 'none',
    gridTemplateRows: 'none',
    gridRowStart: 'auto',
    gridColumnStart: 'auto',
    fontFamily: 'sans-serif',
    fontSize: '14px',
    fontWeight: '400',
    fontStyle: 'normal',
    lineHeight: 'normal',
    letterSpacing: 'normal',
    color: 'rgb(0, 0, 0)',
    textAlign: 'left',
    textTransform: 'none',
    flexGrow: '0',
    flexShrink: '1',
    flexBasis: 'auto',
    width: 'auto',
    height: 'auto',
    ...overrides,
  };
}

interface NodeInput {
  index: number;
  parentIndex: number | null;
  childIndices?: number[];
  semanticTag: string;
  dataAttrs?: Record<string, string>;
  textContent?: string;
  imageMediaId?: string;
}

function node(input: NodeInput): MeasuredNode {
  return {
    index: input.index,
    parentIndex: input.parentIndex,
    childIndices: input.childIndices ?? [],
    semanticTag: input.semanticTag,
    rect: { x: input.index * 10, y: 0, width: 100, height: 50 },
    offsetWidth: 100,
    offsetHeight: 50,
    computedStyle: style(),
    dataAttrs: input.dataAttrs ?? {},
    textContent: input.textContent,
    imageMediaId: input.imageMediaId,
  };
}

const PAGE_ID = '00000000-0000-0000-0000-000000000001' as Uuid;

describe('buildTree — layer naming via data-name', () => {
  it('uses data-name on a frame (container with children)', () => {
    // No rootName: the top frame is promoted and its `data-name` becomes the
    // board's layer name (no synthetic wrapper to absorb it).
    const nodes = [
      node({ index: 0, parentIndex: null, childIndices: [1], semanticTag: 'div', dataAttrs: { 'data-name': 'Hero' } }),
      node({ index: 1, parentIndex: 0, semanticTag: 'p', textContent: 'Welcome' }),
    ];
    const { shapes, rootShapeName } = buildTree({
      nodes,
      pageId: PAGE_ID,
      rootOffset: { x: 0, y: 0 },
    });
    const hero = shapes.find((s) => s.type === 'frame' && s.name === 'Hero');
    expect(hero).toBeDefined();
    expect(rootShapeName).toBe('Hero');
  });

  it('uses data-name on a text leaf when no rootName is given', () => {
    // A single text-only top now promotes to the root shape (no synthetic
    // frame). Without a caller-supplied rootName, the wrapper's data-name
    // becomes the layer name — same priority chain as the frame root.
    const nodes = [
      node({
        index: 0,
        parentIndex: null,
        semanticTag: 'p',
        textContent: 'Hello',
        dataAttrs: { 'data-name': 'Greeting' },
      }),
    ];
    const { shapes, rootShapeName } = buildTree({
      nodes,
      pageId: PAGE_ID,
      rootOffset: { x: 0, y: 0 },
    });
    expect(shapes.length).toBe(1);
    const text = shapes.find((s) => s.type === 'text');
    expect(text?.name).toBe('Greeting');
    expect(rootShapeName).toBe('Greeting');
  });

  it('rootName overrides data-name on a promoted text root', () => {
    const nodes = [
      node({
        index: 0,
        parentIndex: null,
        semanticTag: 'p',
        textContent: 'Hello',
        dataAttrs: { 'data-name': 'Greeting' },
      }),
    ];
    const { shapes, rootShapeName } = buildTree({
      nodes,
      pageId: PAGE_ID,
      rootOffset: { x: 0, y: 0 },
      rootName: 'Board',
    });
    // No synthetic frame — the text IS the root, named per rootName.
    expect(shapes.length).toBe(1);
    const text = shapes.find((s) => s.type === 'text');
    expect(text?.name).toBe('Board');
    expect(rootShapeName).toBe('Board');
  });

  it('uses data-name on an empty leaf (rect)', () => {
    const nodes = [
      node({ index: 0, parentIndex: null, semanticTag: 'div', dataAttrs: { 'data-name': 'Spacer' } }),
    ];
    const { shapes } = buildTree({
      nodes,
      pageId: PAGE_ID,
      rootOffset: { x: 0, y: 0 },
      rootName: 'Board',
    });
    const rect = shapes.find((s) => s.type === 'rect');
    expect(rect?.name).toBe('Spacer');
  });

  it('uses data-name on an image shape', () => {
    const nodes = [
      node({
        index: 0,
        parentIndex: null,
        semanticTag: 'img',
        imageMediaId: '11111111-1111-1111-1111-111111111111',
        dataAttrs: { 'data-name': 'Logo' },
      }),
    ];
    const { shapes } = buildTree({
      nodes,
      pageId: PAGE_ID,
      rootOffset: { x: 0, y: 0 },
      rootName: 'Board',
    });
    const image = shapes.find((s) => s.type === 'image');
    expect(image?.name).toBe('Logo');
  });

  it('falls back to the semantic tag when data-name is missing on inner nodes', () => {
    // Two-level tree so we can check the semantic-tag fallback on a non-root
    // frame. The promoted top frame inherits `rootName` (or the generic
    // default) — the inner frame is the one that exercises the tag fallback.
    const nodes = [
      node({ index: 0, parentIndex: null, childIndices: [1], semanticTag: 'div' }),
      node({ index: 1, parentIndex: 0, childIndices: [2], semanticTag: 'section' }),
      node({ index: 2, parentIndex: 1, semanticTag: 'p', textContent: 'body' }),
    ];
    const { shapes } = buildTree({
      nodes,
      pageId: PAGE_ID,
      rootOffset: { x: 0, y: 0 },
    });
    const sectionFrame = shapes.find((s) => s.type === 'frame' && s.name === 'section');
    expect(sectionFrame).toBeDefined();
    const text = shapes.find((s) => s.type === 'text');
    expect(text?.name).toBe('p');
  });
});

describe('buildTree — CSS rotation', () => {
  it('extracts rotation from a 2D matrix and uses unrotated dims', () => {
    // CSS rotate(-4deg) ⇒ matrix(cos -sin sin cos 0 0) → Penpot rotation +4
    const cos = Math.cos((-4 * Math.PI) / 180);
    const sin = Math.sin((-4 * Math.PI) / 180);
    const transform = `matrix(${cos}, ${sin}, ${-sin}, ${cos}, 0, 0)`;
    const nodes: MeasuredNode[] = [
      {
        index: 0,
        parentIndex: null,
        childIndices: [],
        semanticTag: 'div',
        // bbox of a 100×30 box rotated 4° is slightly larger; fake it small.
        rect: { x: 0, y: 0, width: 102, height: 36 },
        offsetWidth: 100,
        offsetHeight: 30,
        computedStyle: style({ transform }),
        dataAttrs: { 'data-name': 'Tag' },
        textContent: 'OCEAN VIEW',
      },
    ];
    const { shapes } = buildTree({
      nodes,
      pageId: PAGE_ID,
      rootOffset: { x: 0, y: 0 },
      rootName: 'Board',
    });
    const text = shapes.find((s) => s.type === 'text')!;
    expect(text.rotation).toBeCloseTo(4, 3);
    // Width carries +2px slack to absorb font-shaping deltas (see tree.ts).
    expect(text.width).toBe(102);
    expect(text.height).toBe(30);
    // Unrotated rect centred on the bbox centre (51, 18).
    expect(text.x).toBe(1);
    expect(text.y).toBe(3);
  });

  it('keeps rotation 0 and bbox dims when transform is "none"', () => {
    const nodes = [
      node({ index: 0, parentIndex: null, semanticTag: 'div', textContent: 'plain' }),
    ];
    const { shapes } = buildTree({
      nodes,
      pageId: PAGE_ID,
      rootOffset: { x: 0, y: 0 },
      rootName: 'Board',
    });
    const text = shapes.find((s) => s.type === 'text')!;
    expect(text.rotation).toBe(0);
    // +2px slack on text widths (see tree.ts).
    expect(text.width).toBe(102);
    expect(text.height).toBe(50);
  });
});

describe('buildTree — flex shrink rescue for thin leaves', () => {
  it('restores width from inline style when flex shrunk a leaf below it', () => {
    // 1px-wide separator inside a flex row: container is over-constrained, so
    // Chrome shrinks it to 0px. The authored width:1px is the design intent.
    const nodes: MeasuredNode[] = [
      {
        index: 0,
        parentIndex: null,
        childIndices: [],
        semanticTag: 'div',
        rect: { x: 50, y: 10, width: 0, height: 36 },
        offsetWidth: 0,
        offsetHeight: 36,
        computedStyle: style({
          backgroundColor: 'rgb(213, 205, 190)',
          width: '1px',
          height: '36px',
        }),
        dataAttrs: { 'data-name': 'Sep' },
        inlineStyle: 'width:1px; height:36px; background:#D5CDBE;',
      },
    ];
    const { shapes } = buildTree({
      nodes,
      pageId: PAGE_ID,
      rootOffset: { x: 0, y: 0 },
      rootName: 'Board',
    });
    const sep = shapes.find((s) => s.type === 'rect' && s.name === 'Sep');
    expect(sep).toBeDefined();
    expect(sep!.width).toBe(1);
    expect(sep!.height).toBe(36);
  });

  it('does not enlarge a leaf when measured width is already correct', () => {
    const nodes: MeasuredNode[] = [
      {
        index: 0,
        parentIndex: null,
        childIndices: [],
        semanticTag: 'div',
        rect: { x: 0, y: 0, width: 200, height: 100 },
        offsetWidth: 200,
        offsetHeight: 100,
        computedStyle: style({ backgroundColor: 'rgb(0, 0, 0)' }),
        dataAttrs: {},
        inlineStyle: 'width:1px; height:36px;',
      },
    ];
    const { shapes } = buildTree({
      nodes,
      pageId: PAGE_ID,
      rootOffset: { x: 0, y: 0 },
      rootName: 'Board',
    });
    const rect = shapes.find((s) => s.type === 'rect');
    expect(rect!.width).toBe(200);
    expect(rect!.height).toBe(100);
  });
});

describe('buildTree — chip pattern is split into frame + text', () => {
  it('renders a `div` with bg+padding+text as a frame containing a text shape', () => {
    const nodes = [
      {
        index: 0,
        parentIndex: null as number | null,
        childIndices: [] as number[],
        semanticTag: 'div',
        rect: { x: 0, y: 0, width: 80, height: 24 },
        offsetWidth: 80,
        offsetHeight: 24,
        computedStyle: style({
          backgroundColor: 'rgb(245, 241, 234)',
          paddingTop: '4px',
          paddingRight: '8px',
          paddingBottom: '4px',
          paddingLeft: '8px',
          borderTopLeftRadius: '99px',
          borderTopRightRadius: '99px',
          borderBottomRightRadius: '99px',
          borderBottomLeftRadius: '99px',
        }),
        dataAttrs: { 'data-name': 'Chip' },
        textContent: 'OCEAN VIEW',
      } satisfies MeasuredNode,
    ];
    // No rootName: the chip's `data-name` becomes the layer name on the
    // promoted top, which is what an LLM authoring `<div data-name="Chip">`
    // would expect.
    const { shapes } = buildTree({
      nodes,
      pageId: PAGE_ID,
      rootOffset: { x: 0, y: 0 },
    });
    // Promoted-top chip frame + synthesized chip text = 2 shapes (the chip
    // frame doubles as the root; no separate synthetic wrapper).
    expect(shapes.length).toBe(2);

    const frame = shapes.find((s) => s.type === 'frame' && s.name === 'Chip');
    expect(frame).toBeDefined();
    // Frame carries the box visuals: background, radius.
    expect(frame!.fills).toEqual([{ fillColor: '#F5F1EA', fillOpacity: 1 }]);
    expect(frame!.r1).toBe(99);

    const text = shapes.find((s) => s.type === 'text');
    expect(text).toBeDefined();
    // Text is positioned at the inner content-box.
    expect(text!.x).toBe(8);
    expect(text!.y).toBe(4);
    // Width = inner box width + 2px slack.
    expect(text!.width).toBe(66); // (80 - 8 - 8) + 2
    // Text inherits the chip's data-name with a "text" suffix.
    expect(text!.name).toBe('Chip text');
  });
});
