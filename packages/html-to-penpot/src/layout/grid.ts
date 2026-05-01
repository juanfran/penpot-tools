import type { GridCell, GridTrack, Uuid } from '@penpot-tools/converter/types';
import { randomUUID } from 'node:crypto';
import type { MeasuredNode, PickedComputedStyle } from '../types';
import { parseNumber, parsePx } from '../build/css';

export interface GridLayoutFields {
  layoutType: 'grid';
  layoutGridColumns: GridTrack[];
  layoutGridRows: GridTrack[];
  layoutGridCells: Record<string, GridCell>;
}

/**
 * Parse a CSS `grid-template-columns/rows` value into Penpot `GridTrack[]`.
 *
 * The browser computed value is always normalized: `repeat(...)` is expanded,
 * percentages stay as `%`, fr stays as `fr`, fixed lengths are in `px`, and
 * `minmax(...)` collapses to its larger dimension. We only need to recognise
 * the resulting flat list.
 */
export function parseTracks(value: string): GridTrack[] {
  if (!value || value === 'none') return [];
  // Split top-level whitespace, ignoring whitespace inside `[line-name]`.
  const tokens: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '[') depth++;
    if (ch === ']') depth--;
    if (depth === 0 && /\s/.test(ch)) {
      if (current) tokens.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);

  const tracks: GridTrack[] = [];
  for (const tok of tokens) {
    if (tok.startsWith('[') || tok.endsWith(']')) continue; // line names
    if (/^-?\d+(?:\.\d+)?fr$/.test(tok)) {
      tracks.push({ type: 'flex', value: Number(tok.slice(0, -2)) });
    } else if (/^-?\d+(?:\.\d+)?%$/.test(tok)) {
      tracks.push({ type: 'percent', value: Number(tok.slice(0, -1)) });
    } else if (parsePx(tok) !== null) {
      tracks.push({ type: 'fixed', value: parsePx(tok)! });
    } else if (tok === 'auto') {
      tracks.push({ type: 'auto' });
    }
  }
  return tracks;
}

/**
 * Build the Penpot grid container fields from a parent's computed style and
 * the children we already measured.
 *
 * `getComputedStyle` returns `'auto'` for `grid-row-start` / `grid-column-start`
 * of auto-placed items — Chrome never resolves them to the actually-used cell.
 * So we run our own CSS Grid auto-placement: explicit `grid-row` / `grid-column`
 * (when both are integers) become `position: 'manual'`; everything else flows
 * into the next free cell along `grid-auto-flow` (default `row`, scanning
 * left-to-right then top-to-bottom). Without this, every auto-placed child
 * landed on `(row 1, column 1)` and Penpot stacked them all on top of each
 * other instead of distributing across the template.
 *
 * Returns null when the parent isn't a grid container.
 */
export interface GridChildEntry {
  node: MeasuredNode;
  shapeId: Uuid;
}

export function gridLayoutFromComputed(
  parentStyle: PickedComputedStyle,
  children: GridChildEntry[],
): GridLayoutFields | null {
  if (parentStyle.display !== 'grid' && parentStyle.display !== 'inline-grid') return null;
  const layoutGridColumns = parseTracks(parentStyle.gridTemplateColumns);
  const layoutGridRows = parseTracks(parentStyle.gridTemplateRows);

  // CSS default: `grid-auto-flow: row`. The walker passes the computed string
  // verbatim; only the axis token matters here (we don't yet honour `dense`).
  const flowAxis: 'row' | 'column' = (parentStyle.gridAutoFlow || 'row').includes('column')
    ? 'column'
    : 'row';
  // Number of explicit tracks along the cross axis bounds the cursor wrap.
  // When the template is empty (e.g. `grid-template-rows: none` for a flow:row
  // container), we treat it as 1 — the implicit grid will grow as items are
  // placed, but the cursor still needs a wrap point.
  const numCols = Math.max(layoutGridColumns.length, 1);
  const numRows = Math.max(layoutGridRows.length, 1);

  interface Entry extends GridChildEntry {
    cellId: string;
    explicitRow: number | null;
    explicitCol: number | null;
    placedRow: number;
    placedCol: number;
  }

  const entries: Entry[] = children.map(({ node, shapeId }) => ({
    node,
    shapeId,
    cellId: randomUUID(),
    explicitRow: parseNumber(node.computedStyle.gridRowStart),
    explicitCol: parseNumber(node.computedStyle.gridColumnStart),
    placedRow: 0,
    placedCol: 0,
  }));

  const occupied = new Set<string>();
  const key = (r: number, c: number): string => `${r},${c}`;

  // Pass 1: pin every child with explicit `grid-row` AND `grid-column`. They
  // mark their cells occupied regardless of DOM order so subsequent auto
  // children skip over them — this matches the CSS Grid spec.
  for (const entry of entries) {
    if (entry.explicitRow !== null && entry.explicitCol !== null) {
      entry.placedRow = entry.explicitRow;
      entry.placedCol = entry.explicitCol;
      occupied.add(key(entry.placedRow, entry.placedCol));
    }
  }

  // Pass 2: auto-place the rest along the flow axis. The cursor only ever
  // moves forward (sparse placement, the default). Children with only one
  // axis specified are still treated as fully auto here — the partial-axis
  // case is rare in our corpus and would need spec-faithful "next free row
  // for this column" logic that we can add later.
  let cursorRow = 1;
  let cursorCol = 1;
  for (const entry of entries) {
    if (entry.explicitRow !== null && entry.explicitCol !== null) continue;

    if (flowAxis === 'row') {
      while (true) {
        if (cursorCol > numCols) {
          cursorCol = 1;
          cursorRow++;
        }
        if (!occupied.has(key(cursorRow, cursorCol))) {
          entry.placedRow = cursorRow;
          entry.placedCol = cursorCol;
          occupied.add(key(cursorRow, cursorCol));
          cursorCol++;
          break;
        }
        cursorCol++;
      }
    } else {
      while (true) {
        if (cursorRow > numRows) {
          cursorRow = 1;
          cursorCol++;
        }
        if (!occupied.has(key(cursorRow, cursorCol))) {
          entry.placedRow = cursorRow;
          entry.placedCol = cursorCol;
          occupied.add(key(cursorRow, cursorCol));
          cursorRow++;
          break;
        }
        cursorRow++;
      }
    }
  }

  const layoutGridCells: Record<string, GridCell> = {};
  for (const entry of entries) {
    const cell: GridCell = {
      id: entry.cellId as Uuid,
      row: entry.placedRow,
      rowSpan: 1,
      column: entry.placedCol,
      columnSpan: 1,
      // We always compute the resolved cell ourselves — even when the author
      // didn't specify one — so Penpot doesn't need to re-run auto-placement.
      // 'manual' tells the renderer the row/column are authoritative.
      position: 'manual',
      shapes: [entry.shapeId],
    };
    layoutGridCells[entry.cellId] = cell;
  }

  return {
    layoutType: 'grid',
    layoutGridColumns,
    layoutGridRows,
    layoutGridCells,
  };
}
