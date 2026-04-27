import { createServerOnlyFn } from '@tanstack/react-start';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface McpSelection {
  fileId: string;
  pageId: string;
  shapeId?: string;
  teamId?: string;
}

export interface McpState {
  token?: string;
  selection?: McpSelection;
  updatedAt?: string;
}

/**
 * Single JSON file shared between the viewer (writer) and the MCP server (reader).
 * Mono-user app: one global state, no namespacing per user.
 *
 * Override path with PENPOT_RANDOM_STATE_FILE for tests / sandboxed installs.
 */
export function getStateFilePath(): string {
  return (
    process.env['PENPOT_RANDOM_STATE_FILE'] ??
    join(homedir(), '.config', 'penpot-tools', 'state.json')
  );
}

let cache: McpState | null = null;

async function readState(): Promise<McpState> {
  if (cache) return cache;
  try {
    const raw = await readFile(getStateFilePath(), 'utf8');
    cache = JSON.parse(raw) as McpState;
  } catch {
    cache = {};
  }
  return cache;
}

async function writeState(next: McpState): Promise<void> {
  cache = next;
  const path = getStateFilePath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(next, null, 2), 'utf8');
}

export const updateMcpToken = createServerOnlyFn(async (token: string) => {
  const state = await readState();
  await writeState({ ...state, token, updatedAt: new Date().toISOString() });
});

export const updateMcpSelection = createServerOnlyFn(async (selection: McpSelection) => {
  const state = await readState();
  const prev = state.selection;
  if (
    prev &&
    prev.fileId === selection.fileId &&
    prev.pageId === selection.pageId &&
    prev.shapeId === selection.shapeId &&
    prev.teamId === selection.teamId
  ) {
    return;
  }
  await writeState({ ...state, selection, updatedAt: new Date().toISOString() });
});
