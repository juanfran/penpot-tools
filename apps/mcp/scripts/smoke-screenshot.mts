/**
 * Standalone smoke test for the screenshot pipeline.
 *
 * Loads one of the converter integration fixtures from disk (so no Penpot API
 * call), runs it through the same renderScreenshot() that the MCP tool uses,
 * and writes the result to /tmp so you can eyeball it.
 *
 *   pnpm exec tsx scripts/smoke-screenshot.mts
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { convertPage, buildPenpotFontsCss } from '@penpot-random/converter';
import type { ConverterContext } from '@penpot-random/converter';
import { extractTokens, tokensToCss } from '@penpot-random/converter/tokens';
import type { Page } from '@penpot-random/converter/types';
import { renderScreenshot } from '../src/screenshot.ts';

const fixture = resolve(
  import.meta.dirname,
  '../../../packages/converter/src/intengration/card.json',
);
const out = '/tmp/penpot-mcp-smoke.png';

const page = JSON.parse(await readFile(fixture, 'utf8')) as Page;
const tokens = extractTokens(page.objects);
const ctx: ConverterContext = {
  resolveImageUrl: (id) => `https://design.penpot.app/assets/by-file-media-id/${id}`,
  tokens,
  format: false,
};
const { html, fonts } = await convertPage(page, ctx);
const fontsCss = await buildPenpotFontsCss(fonts, { baseUrl: 'https://design.penpot.app' });
const tokensCss = tokensToCss(tokens);

console.error('Rendering screenshot...');
const t0 = Date.now();
const shot = await renderScreenshot({ html, fontsCss, tokensCss });
console.error(`Done in ${Date.now() - t0}ms — ${shot.width}x${shot.height} px`);
await writeFile(out, Buffer.from(shot.base64, 'base64'));
console.error(`Wrote ${out}`);
process.exit(0);
