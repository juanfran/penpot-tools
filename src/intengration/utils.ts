import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Page } from '../penpot.types';

export function getExpected(name: string): string {
  return readFileSync(join(__dirname, `${name}.expected.html`), 'utf-8').trim();
}

export function getPage(name: string): Page {
  return JSON.parse(readFileSync(join(__dirname, `${name}.json`), 'utf-8'));
}
