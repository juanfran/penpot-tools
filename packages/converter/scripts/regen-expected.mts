import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertShape } from '../src/converter/index.ts';
import { extractTokens } from '../src/converter/tokens.ts';
import type { Page } from '../src/penpot.types.ts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const intDir = join(__dirname, '../src/intengration');

function getPage(name: string): Page {
  return JSON.parse(readFileSync(join(intDir, `${name}.json`), 'utf-8')) as Page;
}

const ctx = { resolveImageUrl: (id: string) => `https://assets.example.com/${id}` };

const cases: [string, string, typeof ctx][] = [
  ['example1', '00000000-0000-0000-0000-000000000000', ctx],
  ['svg-group', '183a99e5-79eb-8075-8007-d6f23cf397ee', ctx],
  ['card', '5526cb94-722e-8010-8007-d712339272fd', ctx],
  ['grid-stroke-shadow-overflow', '4300202f-9c79-80a5-8007-d842dc435658', ctx],
  ['image-fill-cover', 'a1b2c3d4-0000-0000-0000-000000000001', ctx],
  ['image-fill', '0d3e2d55-6b68-8009-8007-d9885486fad8', ctx],
  ['graphic-social', 'eaa1384c-05db-801a-8007-d9908cf18cbf', ctx],
  ['icon-menu', 'eaa1384c-05db-801a-8007-d98e7c8afad3', ctx],
  ['button-stroke', 'eaa1384c-05db-801a-8007-d98c8c7c6455', ctx],
  ['flex-auto-sizing', 'col-container', ctx],
  ['flex-absolute-item', 'flex-container', ctx],
  ['flex-column-order', 'col-container', ctx],
  ['text-grow-type', 'frame-a', ctx],
  ['flex-reverse-direction', 'row-rev-panel', ctx],
  ['flex-fill-cross-overflow', 'outer-row', ctx],
  ['path-image-fill', 'eaa1384c-05db-801a-8007-d9937f4003e2', ctx],
];

const tokensPage = getPage('tokens');
const tokensCtx = { ...ctx, tokens: extractTokens(tokensPage.objects) };
cases.push(['tokens', '4300202f-9c79-80a5-8007-d85d33499c1b', tokensCtx]);

for (const [name, shapeId, shapeCtx] of cases) {
  const page = getPage(name);
  const shape = page.objects[shapeId];
  const { html } = await convertShape(shape, page.objects, shapeCtx);
  writeFileSync(join(intDir, `${name}.expected.html`), html.trim() + '\n', 'utf-8');
  console.log('wrote', name);
}
