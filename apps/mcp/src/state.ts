import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

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

export function getStateFilePath(): string {
  return (
    process.env['PENPOT_RANDOM_STATE_FILE'] ??
    join(homedir(), '.config', 'penpot-random', 'state.json')
  );
}

export async function readState(): Promise<McpState> {
  try {
    const raw = await readFile(getStateFilePath(), 'utf8');
    return JSON.parse(raw) as McpState;
  } catch {
    return {};
  }
}

export async function requireToken(): Promise<string> {
  const fromEnv = process.env['PENPOT_TOKEN'];
  if (fromEnv) return fromEnv;
  const state = await readState();
  if (!state.token) {
    throw new Error(
      'No Penpot token available. Open the viewer at http://localhost:3000 and log in, ' +
        'or set PENPOT_TOKEN in the MCP environment.',
    );
  }
  return state.token;
}

export async function requireSelection(): Promise<McpSelection> {
  const state = await readState();
  if (!state.selection) {
    throw new Error(
      'No active selection. Open a page in the viewer (http://localhost:3000) — ' +
        'the file/page you have open in dev mode is what these tools operate on.',
    );
  }
  return state.selection;
}
