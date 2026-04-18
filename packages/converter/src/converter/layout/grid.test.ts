import { describe, it, expect } from 'vitest';
import { gridTracksToStyle, gridCellStyle, findCellForShape } from './grid';
import type { GridTrack, GridCell, FrameShape, Uuid } from '../../penpot.types';

const makeTrack = (type: GridTrack['type'], value?: number): GridTrack => ({ type, value });

describe('gridTracksToStyle', () => {
  it('returns empty string for empty tracks', () => {
    expect(gridTracksToStyle([], 'columns')).toBe('');
  });

  it('converts fixed tracks to px', () => {
    expect(gridTracksToStyle([makeTrack('fixed', 100)], 'columns')).toBe(
      'grid-template-columns: 100px;',
    );
  });

  it('converts percent tracks to %', () => {
    expect(gridTracksToStyle([makeTrack('percent', 50)], 'rows')).toBe('grid-template-rows: 50%;');
  });

  it('converts flex tracks to fr', () => {
    expect(gridTracksToStyle([makeTrack('flex', 2)], 'columns')).toBe(
      'grid-template-columns: 2fr;',
    );
  });

  it('defaults flex track value to 1 when missing', () => {
    expect(gridTracksToStyle([makeTrack('flex')], 'columns')).toBe('grid-template-columns: 1fr;');
  });

  it('converts auto tracks', () => {
    expect(gridTracksToStyle([makeTrack('auto')], 'columns')).toBe('grid-template-columns: auto;');
  });

  it('joins multiple tracks with spaces', () => {
    expect(
      gridTracksToStyle(
        [makeTrack('fixed', 100), makeTrack('flex', 1), makeTrack('auto')],
        'columns',
      ),
    ).toBe('grid-template-columns: 100px 1fr auto;');
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

describe('gridCellStyle', () => {
  it('emits grid-row-start and grid-column-start', () => {
    const result = gridCellStyle(makeCell({ row: 2, column: 3 }));
    expect(result).toContain('grid-row-start: 2;');
    expect(result).toContain('grid-column-start: 3;');
  });

  it('emits grid-row-end when rowSpan > 1', () => {
    expect(gridCellStyle(makeCell({ rowSpan: 2 }))).toContain('grid-row-end: span 2;');
  });

  it('does not emit grid-row-end when rowSpan === 1', () => {
    expect(gridCellStyle(makeCell({ rowSpan: 1 }))).not.toContain('grid-row-end');
  });

  it('emits grid-column-end when columnSpan > 1', () => {
    expect(gridCellStyle(makeCell({ columnSpan: 3 }))).toContain('grid-column-end: span 3;');
  });

  it('does not emit grid-column-end when columnSpan === 1', () => {
    expect(gridCellStyle(makeCell({ columnSpan: 1 }))).not.toContain('grid-column-end');
  });

  it('maps alignSelf to align-self style', () => {
    expect(gridCellStyle(makeCell({ alignSelf: 'center' }))).toContain('align-self: center;');
    expect(gridCellStyle(makeCell({ alignSelf: 'start' }))).toContain('align-self: start;');
    expect(gridCellStyle(makeCell({ alignSelf: 'end' }))).toContain('align-self: end;');
    expect(gridCellStyle(makeCell({ alignSelf: 'stretch' }))).toContain('align-self: stretch;');
  });

  it('skips alignSelf when auto or undefined', () => {
    expect(gridCellStyle(makeCell({ alignSelf: 'auto' }))).not.toContain('align-self');
    expect(gridCellStyle(makeCell())).not.toContain('align-self');
  });

  it('maps justifySelf to justify-self style', () => {
    expect(gridCellStyle(makeCell({ justifySelf: 'center' }))).toContain('justify-self: center;');
    expect(gridCellStyle(makeCell({ justifySelf: 'start' }))).toContain('justify-self: start;');
    expect(gridCellStyle(makeCell({ justifySelf: 'end' }))).toContain('justify-self: end;');
    expect(gridCellStyle(makeCell({ justifySelf: 'stretch' }))).toContain('justify-self: stretch;');
  });

  it('skips justifySelf when auto or undefined', () => {
    expect(gridCellStyle(makeCell({ justifySelf: 'auto' }))).not.toContain('justify-self');
    expect(gridCellStyle(makeCell())).not.toContain('justify-self');
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
    expect(findCellForShape(makeFrame(), 'shape-1' as Uuid)).toBeUndefined();
  });

  it('finds the cell containing the shape', () => {
    const cell = makeCell({ id: 'cell-1' as Uuid, shapes: ['shape-1' as Uuid] });
    const frame = makeFrame({ layoutGridCells: { 'cell-1': cell } });
    expect(findCellForShape(frame, 'shape-1' as Uuid)).toBe(cell);
  });

  it('returns undefined when shape is not in any cell', () => {
    const cell = makeCell({ id: 'cell-1' as Uuid, shapes: ['other' as Uuid] });
    const frame = makeFrame({ layoutGridCells: { 'cell-1': cell } });
    expect(findCellForShape(frame, 'shape-1' as Uuid)).toBeUndefined();
  });
});
