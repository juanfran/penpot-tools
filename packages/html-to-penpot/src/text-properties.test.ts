/**
 * Verifies that text typography survives the headless measurement: in the
 * property-card session I observed `letter-spacing` and `text-transform`
 * apparently dropped on the page. We pin the actual converter behaviour here
 * so future regressions are caught before reaching the LLM loop.
 */
import { describe, expect, it } from 'vitest';
import type { Uuid } from '@penpot-tools/converter/types';
import { htmlToChanges } from './index';

const PAGE_ID = '00000000-0000-0000-0000-000000000001' as Uuid;

interface AnyShape {
  name?: string;
  type?: string;
  content?: {
    children?: Array<{
      children?: Array<{
        children?: Array<{ letterSpacing?: string; textTransform?: string; text?: string }>;
      }>;
    }>;
  };
}

function shapesFrom(changes: Array<unknown>): AnyShape[] {
  return changes
    .filter((c) => (c as { type: string }).type === 'add-obj')
    .map((c) => (c as unknown as { obj: AnyShape }).obj);
}

function textLeaf(shape: AnyShape) {
  return shape.content?.children?.[0]?.children?.[0]?.children?.[0];
}

describe('integration — text typography round-trip', () => {
  it('persists letter-spacing as a positive px value', async () => {
    const html = `<div data-name="Card" style="width:300px; height:60px;">
      <span data-name="Title" style="font-size:14px; letter-spacing:2px;">HELLO</span>
    </div>`;
    const { changes, warnings } = await htmlToChanges(html, { pageId: PAGE_ID });
    const title = shapesFrom(changes).find((s) => s.name === 'Title' && s.type === 'text')!;
    expect(title).toBeDefined();
    const leaf = textLeaf(title);
    expect(leaf?.letterSpacing).toBe('2');
    expect(warnings.find((w) => w.toLowerCase().includes('letter'))).toBeUndefined();
  }, 20_000);

  it('persists negative letter-spacing (tight tracking)', async () => {
    const html = `<div data-name="Card" style="width:300px; height:60px;">
      <span data-name="Tight" style="font-size:48px; letter-spacing:-2px;">Big</span>
    </div>`;
    const { changes } = await htmlToChanges(html, { pageId: PAGE_ID });
    const leaf = textLeaf(shapesFrom(changes).find((s) => s.name === 'Tight')!);
    expect(leaf?.letterSpacing).toBe('-2');
  }, 20_000);

  it('pre-applies text-transform:uppercase so the stored glyphs are upper-cased', async () => {
    // Pre-fix: Chromium normalises `text-transform` at render time; the
    // walker only ever sees the authored "hello" glyphs and Penpot's
    // textTransform field was hardcoded to 'none'. Result: a TOWNHOUSE chip
    // authored as `<span style="text-transform:uppercase">townhouse</span>`
    // landed in Penpot as lowercase. Now the build step applies the transform
    // to the stored text so the chip reads correctly even after edits.
    const html = `<div data-name="Card" style="width:300px; height:40px;">
      <span data-name="Cap" style="font-size:14px; text-transform:uppercase;">hello</span>
    </div>`;
    const { changes, warnings } = await htmlToChanges(html, { pageId: PAGE_ID });
    const leaf = textLeaf(shapesFrom(changes).find((s) => s.name === 'Cap')!);
    expect(leaf?.text).toBe('HELLO');
    // We pre-applied, so the stored value is already upper-cased glyphs and
    // no further transform must be re-applied by Penpot's text engine.
    expect(leaf?.textTransform).toBe('none');
    // No warning — the transform was honoured silently.
    expect(
      warnings.find((w) => w.toLowerCase().includes('text-transform')),
    ).toBeUndefined();
  }, 20_000);

  it('pre-applies text-transform:lowercase and capitalize too', async () => {
    const html = `<div data-name="Card" style="width:600px; height:120px;">
      <span data-name="Down" style="font-size:14px; text-transform:lowercase;">SHOUTY</span>
      <span data-name="Cap" style="font-size:14px; text-transform:capitalize;">hello world</span>
    </div>`;
    const { changes } = await htmlToChanges(html, { pageId: PAGE_ID });
    const down = textLeaf(shapesFrom(changes).find((s) => s.name === 'Down')!);
    const cap = textLeaf(shapesFrom(changes).find((s) => s.name === 'Cap')!);
    expect(down?.text).toBe('shouty');
    expect(cap?.text).toBe('Hello World');
  }, 20_000);
});
