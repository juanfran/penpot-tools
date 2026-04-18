import type { GridTrack, GridCell, GridCellAlign, FrameShape, Uuid } from '../../penpot.types';

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

export function gridTracksToStyle(tracks: GridTrack[], axis: 'columns' | 'rows'): string {
  if (tracks.length === 0) return '';
  const prop = axis === 'columns' ? 'grid-template-columns' : 'grid-template-rows';
  const value = tracks.map(trackValue).join(' ');
  return `${prop}: ${value};`;
}

const ALIGN_MAP: Partial<Record<GridCellAlign, string>> = {
  start: 'start',
  center: 'center',
  end: 'end',
  stretch: 'stretch',
};

export function gridCellStyle(cell: GridCell): string {
  const parts: string[] = [];

  parts.push(`grid-row-start: ${cell.row};`);
  if (cell.rowSpan > 1) parts.push(`grid-row-end: span ${cell.rowSpan};`);
  parts.push(`grid-column-start: ${cell.column};`);
  if (cell.columnSpan > 1) parts.push(`grid-column-end: span ${cell.columnSpan};`);

  if (cell.alignSelf && ALIGN_MAP[cell.alignSelf]) {
    parts.push(`align-self: ${ALIGN_MAP[cell.alignSelf]};`);
  }
  if (cell.justifySelf && ALIGN_MAP[cell.justifySelf]) {
    parts.push(`justify-self: ${ALIGN_MAP[cell.justifySelf]};`);
  }

  return parts.join(' ');
}

export function findCellForShape(frame: FrameShape, shapeId: Uuid): GridCell | undefined {
  if (!frame.layoutGridCells) return undefined;
  return Object.values(frame.layoutGridCells).find((cell) => cell.shapes.includes(shapeId));
}
