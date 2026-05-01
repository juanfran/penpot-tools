import { describe, expect, it } from 'vitest';
import type { MeasuredNode, PickedComputedStyle } from '../types';
import { detectTightFlexRows } from './tight-flex';

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
    fontSize: '13px',
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

function node(input: {
  index: number;
  parentIndex: number | null;
  childIndices?: number[];
  semanticTag?: string;
  dataName?: string;
  textContent?: string;
  rectHeight?: number;
  rectWidth?: number;
  computedStyle?: PickedComputedStyle;
}): MeasuredNode {
  return {
    index: input.index,
    parentIndex: input.parentIndex,
    childIndices: input.childIndices ?? [],
    semanticTag: input.semanticTag ?? 'div',
    rect: { x: 0, y: 0, width: input.rectWidth ?? 60, height: input.rectHeight ?? 16 },
    offsetWidth: input.rectWidth ?? 60,
    offsetHeight: input.rectHeight ?? 16,
    computedStyle: input.computedStyle ?? style(),
    dataAttrs: input.dataName ? { 'data-name': input.dataName } : {},
    textContent: input.textContent,
  };
}

describe('detectTightFlexRows', () => {
  it('warns when text in a flex row wraps to two lines', () => {
    const parent = node({
      index: 0,
      parentIndex: null,
      childIndices: [1],
      dataName: 'Specs strip',
      computedStyle: style({ display: 'flex', flexDirection: 'row' }),
    });
    const child = node({
      index: 1,
      parentIndex: 0,
      textContent: '2,840 sq ft',
      // 13px @ line-height 1.2 = 15.6px per line. Two lines ≈ 31px > threshold 23.4.
      rectHeight: 31,
    });
    const warns = detectTightFlexRows([parent, child]);
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain('"2,840 sq ft"');
    expect(warns[0]).toContain('"Specs strip"');
  });

  it('does not warn for a single-line text in a flex row', () => {
    const parent = node({
      index: 0,
      parentIndex: null,
      childIndices: [1],
      computedStyle: style({ display: 'flex' }),
    });
    const child = node({
      index: 1,
      parentIndex: 0,
      textContent: '4 bd',
      rectHeight: 16,
    });
    expect(detectTightFlexRows([parent, child])).toEqual([]);
  });

  it('does not warn when the parent is a flex column', () => {
    const parent = node({
      index: 0,
      parentIndex: null,
      childIndices: [1],
      computedStyle: style({ display: 'flex', flexDirection: 'column' }),
    });
    const child = node({
      index: 1,
      parentIndex: 0,
      textContent: 'Multi-line allowed',
      rectHeight: 60,
    });
    expect(detectTightFlexRows([parent, child])).toEqual([]);
  });

  it('does not warn when the text contains an explicit \\n', () => {
    const parent = node({
      index: 0,
      parentIndex: null,
      childIndices: [1],
      computedStyle: style({ display: 'flex' }),
    });
    const child = node({
      index: 1,
      parentIndex: 0,
      textContent: 'Line one\nLine two',
      rectHeight: 40,
    });
    expect(detectTightFlexRows([parent, child])).toEqual([]);
  });

  it('honours an explicit `line-height: Npx` declaration', () => {
    const parent = node({
      index: 0,
      parentIndex: null,
      childIndices: [1],
      computedStyle: style({ display: 'flex' }),
    });
    // line-height: 30px → threshold 30 * 1.5 = 45. A 40px-high single line is fine.
    const child = node({
      index: 1,
      parentIndex: 0,
      textContent: 'Tall single line',
      rectHeight: 40,
      computedStyle: style({ fontSize: '20px', lineHeight: '30px' }),
    });
    expect(detectTightFlexRows([parent, child])).toEqual([]);
  });

  it('does not warn for non-flex parents', () => {
    const parent = node({ index: 0, parentIndex: null, childIndices: [1] });
    const child = node({
      index: 1,
      parentIndex: 0,
      textContent: 'Wrapped',
      rectHeight: 40,
    });
    expect(detectTightFlexRows([parent, child])).toEqual([]);
  });
});
