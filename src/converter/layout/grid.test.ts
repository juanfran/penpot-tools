import { describe, it, expect } from 'vitest';
import { gridTracksToClass, gridCellClasses, findCellForShape } from './grid';
import type { GridTrack, GridCell, FrameShape, Uuid } from '../../penpot.types';

const makeTrack = (type: GridTrack['type'], value?: number): GridTrack => ({
  type,
  value,
});

describe('gridTracksToClass', () => {
  it('returns empty string for empty tracks', () => {
    expect(gridTracksToClass([], 'columns')).toBe('');
  });

  it('converts fixed tracks to px', () => {
    expect(gridTracksToClass([makeTrack('fixed', 100)], 'columns')).toBe('grid-cols-[100px]');
  });

  it('converts percent tracks to %', () => {
    expect(gridTracksToClass([makeTrack('percent', 50)], 'rows')).toBe('grid-rows-[50%]');
  });

  it('converts flex tracks to fr', () => {
    expect(gridTracksToClass([makeTrack('flex', 2)], 'columns')).toBe('grid-cols-[2fr]');
  });

  it('defaults flex track value to 1 when missing', () => {
    expect(gridTracksToClass([makeTrack('flex')], 'columns')).toBe('grid-cols-[1fr]');
  });

  it('converts auto tracks', () => {
    expect(gridTracksToClass([makeTrack('auto')], 'columns')).toBe('grid-cols-[auto]');
  });

  it('joins multiple tracks with underscores', () => {
    expect(
      gridTracksToClass(
        [makeTrack('fixed', 100), makeTrack('flex', 1), makeTrack('auto')],
        'columns',
      ),
    ).toBe('grid-cols-[100px_1fr_auto]');
  });
});

const makeCell = (overrides: Partial<GridCell> = {}): GridCell => ({
  id: 'cell-1' as Uuid,
  row: 1,
  rowSpan: 1,
  column: 1,
  columnSpan: 1,
  shapes: [],
  ...overrides,
});

describe('gridCellClasses', () => {
  it('emits row-start and col-start', () => {
    const result = gridCellClasses(makeCell({ row: 2, column: 3 }));
    expect(result).toContain('row-start-[2]');
    expect(result).toContain('col-start-[3]');
  });

  it('emits row-span when rowSpan > 1', () => {
    const result = gridCellClasses(makeCell({ rowSpan: 2 }));
    expect(result).toContain('row-span-[2]');
  });

  it('does not emit row-span when rowSpan === 1', () => {
    const result = gridCellClasses(makeCell({ rowSpan: 1 }));
    expect(result).not.toContain('row-span');
  });

  it('emits col-span when columnSpan > 1', () => {
    const result = gridCellClasses(makeCell({ columnSpan: 3 }));
    expect(result).toContain('col-span-[3]');
  });

  it('does not emit col-span when columnSpan === 1', () => {
    const result = gridCellClasses(makeCell({ columnSpan: 1 }));
    expect(result).not.toContain('col-span');
  });

  it('maps alignSelf to self-* class', () => {
    expect(gridCellClasses(makeCell({ alignSelf: 'center' }))).toContain('self-center');
    expect(gridCellClasses(makeCell({ alignSelf: 'start' }))).toContain('self-start');
    expect(gridCellClasses(makeCell({ alignSelf: 'end' }))).toContain('self-end');
    expect(gridCellClasses(makeCell({ alignSelf: 'stretch' }))).toContain('self-stretch');
  });

  it('skips alignSelf when auto or undefined', () => {
    expect(gridCellClasses(makeCell({ alignSelf: 'auto' }))).not.toContain('self-');
    expect(gridCellClasses(makeCell())).not.toContain('self-');
  });

  it('maps justifySelf to justify-self-* class', () => {
    expect(gridCellClasses(makeCell({ justifySelf: 'center' }))).toContain('justify-self-center');
    expect(gridCellClasses(makeCell({ justifySelf: 'start' }))).toContain('justify-self-start');
    expect(gridCellClasses(makeCell({ justifySelf: 'end' }))).toContain('justify-self-end');
    expect(gridCellClasses(makeCell({ justifySelf: 'stretch' }))).toContain('justify-self-stretch');
  });

  it('skips justifySelf when auto or undefined', () => {
    expect(gridCellClasses(makeCell({ justifySelf: 'auto' }))).not.toContain('justify-self-');
    expect(gridCellClasses(makeCell())).not.toContain('justify-self-');
  });
});

const makeFrame = (overrides: Partial<FrameShape> = {}): FrameShape => ({
  id: 'frame-1' as Uuid,
  name: 'Frame',
  type: 'frame',
  x: 0,
  y: 0,
  width: 400,
  height: 300,
  shapes: [],
  selrect: { x: 0, y: 0, width: 400, height: 300 },
  points: [],
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  parentId: 'frame-1' as Uuid,
  frameId: 'frame-1' as Uuid,
  ...overrides,
});

describe('findCellForShape', () => {
  it('returns undefined when no layoutGridCells', () => {
    const frame = makeFrame();
    expect(findCellForShape(frame, 'shape-1' as Uuid)).toBeUndefined();
  });

  it('finds the cell containing the shape', () => {
    const cell = makeCell({
      id: 'cell-1' as Uuid,
      shapes: ['shape-1' as Uuid],
    });
    const frame = makeFrame({ layoutGridCells: { 'cell-1': cell } });
    expect(findCellForShape(frame, 'shape-1' as Uuid)).toBe(cell);
  });

  it('returns undefined when shape is not in any cell', () => {
    const cell = makeCell({ id: 'cell-1' as Uuid, shapes: ['other' as Uuid] });
    const frame = makeFrame({ layoutGridCells: { 'cell-1': cell } });
    expect(findCellForShape(frame, 'shape-1' as Uuid)).toBeUndefined();
  });
});
