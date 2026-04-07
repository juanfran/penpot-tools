import type {
  GridTrack,
  GridCell,
  GridCellAlign,
  FrameShape,
  Uuid,
} from '../../penpot.types';
import { cls } from '../utils/tailwind';

function trackValue(track: GridTrack): string {
  switch (track.type) {
    case 'fixed':
      return `${track.value ?? 0}px`;
    case 'percent':
      return `${track.value ?? 0}%`;
    case 'flex':
      return `${track.value ?? 1}fr`;
    case 'auto':
      return 'auto';
  }
}

/**
 * Converts an array of `GridTrack` into a CSS `grid-template-columns` or
 * `grid-template-rows` inline style property string.
 *
 * Returns an empty string when `tracks` is empty.
 */
export function gridTracksToStyle(
  tracks: GridTrack[],
  axis: 'columns' | 'rows',
): string {
  if (tracks.length === 0) return '';
  const prop =
    axis === 'columns' ? 'grid-template-columns' : 'grid-template-rows';
  return `${prop}: ${tracks.map(trackValue).join(' ')};`;
}

const ALIGN_MAP: Partial<Record<GridCellAlign, string>> = {
  start: 'start',
  center: 'center',
  end: 'end',
  stretch: 'stretch',
};

/**
 * Returns Tailwind grid placement classes for a single `GridCell`.
 *
 * - `row` → `row-start-[N]`
 * - `rowSpan > 1` → `row-span-[N]`
 * - `column` → `col-start-[N]`
 * - `columnSpan > 1` → `col-span-[N]`
 * - `alignSelf` → `self-*` (skipped for 'auto' or undefined)
 * - `justifySelf` → `justify-self-*` (skipped for 'auto' or undefined)
 */
export function gridCellClasses(cell: GridCell): string {
  const alignClass =
    cell.alignSelf && ALIGN_MAP[cell.alignSelf]
      ? `self-${ALIGN_MAP[cell.alignSelf]}`
      : undefined;

  const justifyClass =
    cell.justifySelf && ALIGN_MAP[cell.justifySelf]
      ? `justify-self-${ALIGN_MAP[cell.justifySelf]}`
      : undefined;

  return cls(
    `row-start-[${cell.row}]`,
    cell.rowSpan > 1 ? `row-span-[${cell.rowSpan}]` : undefined,
    `col-start-[${cell.column}]`,
    cell.columnSpan > 1 ? `col-span-[${cell.columnSpan}]` : undefined,
    alignClass,
    justifyClass,
  );
}

/**
 * Finds the `GridCell` in `frame.layoutGridCells` that contains `shapeId`.
 *
 * Returns `undefined` if no cell contains the shape.
 */
export function findCellForShape(
  frame: FrameShape,
  shapeId: Uuid,
): GridCell | undefined {
  if (!frame.layoutGridCells) return undefined;
  return Object.values(frame.layoutGridCells).find((cell) =>
    cell.shapes.includes(shapeId),
  );
}
