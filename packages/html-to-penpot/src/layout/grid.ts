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
 * the children we already measured. Each child's `grid-row-start` /
 * `grid-column-start` is read from its computed style (1-based, like CSS).
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

  const layoutGridCells: Record<string, GridCell> = {};
  for (const { node, shapeId } of children) {
    const id = randomUUID();
    const row = parseNumber(node.computedStyle.gridRowStart);
    const column = parseNumber(node.computedStyle.gridColumnStart);
    const cell: GridCell = {
      id: id as Uuid,
      row: row ?? 1,
      rowSpan: 1,
      column: column ?? 1,
      columnSpan: 1,
      position: row !== null && column !== null ? 'manual' : 'auto',
      shapes: [shapeId],
    };
    layoutGridCells[id] = cell;
  }

  return {
    layoutType: 'grid',
    layoutGridColumns,
    layoutGridRows,
    layoutGridCells,
  };
}
