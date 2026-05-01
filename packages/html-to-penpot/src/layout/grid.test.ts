import { describe, expect, it } from 'vitest';
import type { Uuid } from '@penpot-tools/converter/types';
import type { MeasuredNode, PickedComputedStyle } from '../types';
import { gridLayoutFromComputed, parseTracks, type GridChildEntry } from './grid';

function style(overrides: Partial<PickedComputedStyle> = {}): PickedComputedStyle {
  return {
    display: 'grid',
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
    gridAutoFlow: 'row',
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

function child(id: string, overrides: Partial<PickedComputedStyle> = {}): GridChildEntry {
  const node: MeasuredNode = {
    index: 0,
    parentIndex: 0,
    childIndices: [],
    semanticTag: 'div',
    rect: { x: 0, y: 0, width: 100, height: 50 },
    offsetWidth: 100,
    offsetHeight: 50,
    computedStyle: style(overrides),
    dataAttrs: {},
  };
  return { node, shapeId: id as Uuid };
}

/**
 * Map shapeId → { row, column } from the layoutGridCells dictionary. The cell
 * ids are random UUIDs so we can't address them directly — we look up by the
 * single shape each cell references.
 */
function cellsByShape(
  layoutGridCells: Record<string, { row: number; column: number; shapes: Uuid[] }>,
): Record<string, { row: number; column: number }> {
  const out: Record<string, { row: number; column: number }> = {};
  for (const cell of Object.values(layoutGridCells)) {
    for (const shapeId of cell.shapes) out[shapeId] = { row: cell.row, column: cell.column };
  }
  return out;
}

describe('parseTracks', () => {
  it('returns [] for none / empty', () => {
    expect(parseTracks('none')).toEqual([]);
    expect(parseTracks('')).toEqual([]);
  });

  it('parses fr / px / % / auto', () => {
    expect(parseTracks('1fr 2fr')).toEqual([
      { type: 'flex', value: 1 },
      { type: 'flex', value: 2 },
    ]);
    expect(parseTracks('100px 50%')).toEqual([
      { type: 'fixed', value: 100 },
      { type: 'percent', value: 50 },
    ]);
    expect(parseTracks('auto auto auto')).toEqual([
      { type: 'auto' },
      { type: 'auto' },
      { type: 'auto' },
    ]);
  });

  it('parses the value Chrome returns for repeat(3, 1fr)', () => {
    // The browser computed value is always the expanded form.
    expect(parseTracks('1fr 1fr 1fr')).toEqual([
      { type: 'flex', value: 1 },
      { type: 'flex', value: 1 },
      { type: 'flex', value: 1 },
    ]);
  });
});

describe('gridLayoutFromComputed', () => {
  it('returns null for non-grid containers', () => {
    expect(gridLayoutFromComputed(style({ display: 'block' }), [])).toBeNull();
    expect(gridLayoutFromComputed(style({ display: 'flex' }), [])).toBeNull();
  });

  it('parses tracks from the parent style', () => {
    const result = gridLayoutFromComputed(
      style({ gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '100px auto' }),
      [],
    );
    expect(result?.layoutType).toBe('grid');
    expect(result?.layoutGridColumns).toEqual([
      { type: 'flex', value: 1 },
      { type: 'flex', value: 1 },
      { type: 'flex', value: 1 },
    ]);
    expect(result?.layoutGridRows).toEqual([
      { type: 'fixed', value: 100 },
      { type: 'auto' },
    ]);
  });

  it('auto-places six children across a 3-column row-flow grid', () => {
    // The exact case the user's landing hit: six benefit cards in
    // `grid-template-columns: repeat(3, 1fr)` with no explicit row/column on
    // any child. The previous implementation read `gridRowStart: 'auto'` /
    // `gridColumnStart: 'auto'` and parked every cell at (1, 1) — the cards
    // stacked. Now they wrap left-to-right, top-to-bottom across two rows.
    const result = gridLayoutFromComputed(
      style({ gridTemplateColumns: '1fr 1fr 1fr' }),
      ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map((id) => child(id)),
    );
    expect(result).not.toBeNull();
    const placement = cellsByShape(result!.layoutGridCells);
    expect(placement).toEqual({
      c1: { row: 1, column: 1 },
      c2: { row: 1, column: 2 },
      c3: { row: 1, column: 3 },
      c4: { row: 2, column: 1 },
      c5: { row: 2, column: 2 },
      c6: { row: 2, column: 3 },
    });
  });

  it('auto-places four children across a 4-column grid in a single row', () => {
    const result = gridLayoutFromComputed(
      style({ gridTemplateColumns: '1fr 1fr 1fr 1fr' }),
      ['m1', 'm2', 'm3', 'm4'].map((id) => child(id)),
    );
    const placement = cellsByShape(result!.layoutGridCells);
    expect(placement).toEqual({
      m1: { row: 1, column: 1 },
      m2: { row: 1, column: 2 },
      m3: { row: 1, column: 3 },
      m4: { row: 1, column: 4 },
    });
  });

  it('marks every emitted cell as `manual` since we resolve placement ourselves', () => {
    // Penpot's `position: 'auto'` means "let Penpot run auto-placement". We
    // already did the work in JS, so the row/column are authoritative.
    const result = gridLayoutFromComputed(
      style({ gridTemplateColumns: '1fr 1fr' }),
      ['a', 'b'].map((id) => child(id)),
    );
    for (const cell of Object.values(result!.layoutGridCells)) {
      expect(cell.position).toBe('manual');
    }
  });

  it('honours an explicit grid-row / grid-column on a child', () => {
    // First child is auto-placed; second is pinned at (2, 3); third is
    // auto-placed and must skip the cell already taken by the second.
    const result = gridLayoutFromComputed(
      style({ gridTemplateColumns: '1fr 1fr 1fr' }),
      [
        child('first'),
        child('pinned', { gridRowStart: '2', gridColumnStart: '3' }),
        child('after-pin'),
        child('after-pin-2'),
        child('after-pin-3'),
      ],
    );
    const placement = cellsByShape(result!.layoutGridCells);
    expect(placement).toEqual({
      first: { row: 1, column: 1 },
      pinned: { row: 2, column: 3 },
      'after-pin': { row: 1, column: 2 },
      'after-pin-2': { row: 1, column: 3 },
      'after-pin-3': { row: 2, column: 1 },
    });
  });

  it('flows column-first when grid-auto-flow is `column`', () => {
    // Two-row template with column flow: items fill the first column top-to-
    // bottom, then move to the second column, then the third.
    const result = gridLayoutFromComputed(
      style({
        gridTemplateColumns: '1fr 1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gridAutoFlow: 'column',
      }),
      ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => child(id)),
    );
    const placement = cellsByShape(result!.layoutGridCells);
    expect(placement).toEqual({
      a: { row: 1, column: 1 },
      b: { row: 2, column: 1 },
      c: { row: 1, column: 2 },
      d: { row: 2, column: 2 },
      e: { row: 1, column: 3 },
      f: { row: 2, column: 3 },
    });
  });

  it('still produces one cell per child even when no template is declared', () => {
    // `display: grid` with no `grid-template-columns` is unusual but valid.
    // The cursor wraps after one column (numCols defaults to 1) so every
    // child gets its own row.
    const result = gridLayoutFromComputed(
      style(),
      ['a', 'b', 'c'].map((id) => child(id)),
    );
    const placement = cellsByShape(result!.layoutGridCells);
    expect(placement).toEqual({
      a: { row: 1, column: 1 },
      b: { row: 2, column: 1 },
      c: { row: 3, column: 1 },
    });
  });

  it('accepts inline-grid as a grid container', () => {
    const result = gridLayoutFromComputed(
      style({ display: 'inline-grid', gridTemplateColumns: '1fr 1fr' }),
      ['x', 'y'].map((id) => child(id)),
    );
    expect(result).not.toBeNull();
    const placement = cellsByShape(result!.layoutGridCells);
    expect(placement.x).toEqual({ row: 1, column: 1 });
    expect(placement.y).toEqual({ row: 1, column: 2 });
  });

  it('attaches each shapeId to its own cell', () => {
    const result = gridLayoutFromComputed(
      style({ gridTemplateColumns: '1fr 1fr' }),
      ['a', 'b', 'c', 'd'].map((id) => child(id)),
    );
    const cells = Object.values(result!.layoutGridCells);
    expect(cells).toHaveLength(4);
    const shapesAcrossCells = cells.flatMap((c) => c.shapes);
    expect(shapesAcrossCells).toHaveLength(4);
    expect(new Set(shapesAcrossCells)).toEqual(new Set(['a', 'b', 'c', 'd']));
  });
});
