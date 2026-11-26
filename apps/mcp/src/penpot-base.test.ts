import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPenpotBase } from './penpot-api.ts';

describe('getPenpotBase', () => {
  let dir: string;
  let stateFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'penpot-base-'));
    stateFile = join(dir, 'state.json');
    vi.stubEnv('PENPOT_RANDOM_STATE_FILE', stateFile);
    vi.stubEnv('PENPOT_BASE_URL', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it('defaults to design.penpot.app without env or state', () => {
    expect(getPenpotBase()).toBe('https://design.penpot.app');
  });

  it('follows the instance the viewer logged into', () => {
    writeFileSync(stateFile, JSON.stringify({ baseUrl: 'https://penpot.example.com/' }));
    expect(getPenpotBase()).toBe('https://penpot.example.com');
  });

  it('lets PENPOT_BASE_URL override the viewer state', () => {
    writeFileSync(stateFile, JSON.stringify({ baseUrl: 'https://penpot.example.com' }));
    vi.stubEnv('PENPOT_BASE_URL', 'http://localhost:9001');
    expect(getPenpotBase()).toBe('http://localhost:9001');
  });
});
