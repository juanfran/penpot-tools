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
    computedStyle: style(),
    dataAttrs: input.dataAttrs ?? {},
    textContent: input.textContent,
    imageMediaId: input.imageMediaId,
  };
}

const PAGE_ID = '00000000-0000-0000-0000-000000000001' as Uuid;

describe('buildTree — layer naming via data-name', () => {
  it('uses data-name on a frame (container with children)', () => {
    const nodes = [
      node({ index: 0, parentIndex: null, childIndices: [1], semanticTag: 'div', dataAttrs: { 'data-name': 'Hero' } }),
      node({ index: 1, parentIndex: 0, semanticTag: 'p', textContent: 'Welcome' }),
    ];
    const { shapes } = buildTree({
      nodes,
      pageId: PAGE_ID,
      rootOffset: { x: 0, y: 0 },
      rootName: 'Board',
    });
    const hero = shapes.find((s) => s.type === 'frame' && s.name === 'Hero');
    expect(hero).toBeDefined();
  });

  it('uses data-name on a text leaf', () => {
    const nodes = [
      node({
        index: 0,
        parentIndex: null,
        semanticTag: 'p',
        textContent: 'Hello',
        dataAttrs: { 'data-name': 'Greeting' },
      }),
    ];
    const { shapes } = buildTree({
      nodes,
      pageId: PAGE_ID,
      rootOffset: { x: 0, y: 0 },
      rootName: 'Board',
    });
    const text = shapes.find((s) => s.type === 'text');
    expect(text?.name).toBe('Greeting');
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

  it('falls back to the semantic tag when data-name is missing', () => {
    const nodes = [
      node({ index: 0, parentIndex: null, childIndices: [1], semanticTag: 'section' }),
      node({ index: 1, parentIndex: 0, semanticTag: 'p', textContent: 'body' }),
    ];
    const { shapes } = buildTree({
      nodes,
      pageId: PAGE_ID,
      rootOffset: { x: 0, y: 0 },
      rootName: 'Board',
    });
    const frame = shapes.find((s) => s.type === 'frame' && s.name !== 'Board');
    expect(frame?.name).toBe('section');
    const text = shapes.find((s) => s.type === 'text');
    expect(text?.name).toBe('p');
  });
});
