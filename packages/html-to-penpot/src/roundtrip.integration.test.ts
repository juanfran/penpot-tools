/**
 * HTML → Penpot → HTML round-trip fidelity.
 *
 * The MCP write path (`create_design_from_html`) and the MCP read path
 * (`get_html`) share an unspoken contract: the LLM authors HTML, the design is
 * persisted, and the read-back HTML must let the LLM reason about the result
 * (and ideally re-author it) without semantic drift. These tests pin down the
 * properties that contract depends on.
 *
 * We exercise the real headless Chromium pipeline (`htmlToChanges`) and the
 * real Penpot→HTML converter (`convertShape`), with the in-memory `objects`
 * map reconstructed from the `add-obj` changes. No HTTP traffic — the test is
 * deterministic and runs in ~1s after the browser has booted.
 *
 * Each assertion guards against a real bug shipped to users:
 *   - Duplicate `width:`/`height:` declarations on text shapes (mergeStyles
 *     didn't dedupe — see `utils/style.ts`).
 *   - Tailwind preflight cascading `line-height: 1.5` into every text leaf
 *     (see `text-content.ts:lineHeightOf`).
 *   - `data-name` lost on read-back (see `converter/render.ts`).
 */
import { afterAll, describe, expect, it } from 'vitest';
import type { Shape, Uuid } from '@penpot-tools/converter/types';
import { convertShape } from '@penpot-tools/converter';
import { htmlToChanges } from './index';

const PAGE_ID = '00000000-0000-0000-0000-000000000001' as Uuid;

afterAll(() => {
  // Headless browser cleanup is registered in measure/headless.ts via beforeExit.
});

interface AddObjChange {
  type: 'add-obj';
  obj: Shape;
}

function objectsFromChanges(changes: unknown[]): Record<string, Shape> {
  const out: Record<string, Shape> = {};
  for (const c of changes) {
    const change = c as { type?: string };
    if (change.type !== 'add-obj') continue;
    const obj = (c as AddObjChange).obj;
    out[obj.id] = obj;
  }
  return out;
}

function countDeclaration(style: string, prop: string): number {
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:`, 'gi');
  return (style.match(re) ?? []).length;
}

function styleAttrsOf(html: string): string[] {
  const out: string[] = [];
  const re = /style="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1]!);
  return out;
}

async function roundtrip(html: string): Promise<{
  shapes: Shape[];
  rootShape: Shape;
  rendered: string;
  warnings: string[];
}> {
  const bundle = await htmlToChanges(html, { pageId: PAGE_ID });
  const objects = objectsFromChanges(bundle.changes);
  const rootShape = objects[bundle.rootShapeId];
  if (!rootShape) throw new Error('root shape missing from changes');

  const { html: rendered } = await convertShape(rootShape, objects, {
    format: false,
    resolveImageUrl: (id) => `image:${id}`,
  });
  return {
    shapes: Object.values(objects),
    rootShape,
    rendered,
    warnings: bundle.warnings,
  };
}

describe('round-trip: declarations are not duplicated', () => {
  it('a positioned text element produces one width/height pair, not two', async () => {
    const html = `<div data-name="Card" style="position:relative; width:520px; height:160px; background:#FFF;">
      <div data-name="Title" style="position:absolute; left:24px; top:24px; font-size:48px; font-weight:600; color:#1B1B1A;">Hello</div>
    </div>`;

    const { rendered, warnings } = await roundtrip(html);
    expect(warnings).toEqual([]);

    for (const styleAttr of styleAttrsOf(rendered)) {
      expect(countDeclaration(styleAttr, 'width')).toBeLessThanOrEqual(1);
      expect(countDeclaration(styleAttr, 'height')).toBeLessThanOrEqual(1);
    }
    // Sanity: the title was actually rendered with explicit dimensions.
    expect(rendered).toMatch(/data-name="Title"[^>]*width:\s*\d+px/);
  }, 30_000);
});

describe('round-trip: line-height is not inflated by the preflight cascade', () => {
  // Penpot text shapes nest the typography styles on inner <p>/<span> elements
  // (one paragraph per line). Pluck the text shape's whole subtree by data-id
  // so we can assert on the leaf style rather than the wrapping div's box.
  function textSubtreeFor(rendered: string, dataName: string): string {
    const m = rendered.match(
      new RegExp(`<div[^>]*data-name="${dataName}"[^>]*data-type="text"[^>]*>([\\s\\S]*?)</div>`),
    );
    if (!m) throw new Error(`no text shape with data-name="${dataName}" in:\n${rendered}`);
    return m[1]!;
  }

  it('text without an authored line-height defaults to 1.2 on read-back', async () => {
    // Authored fragment intentionally omits `line-height` — the preflight
    // cascades 1.5 down, so the bug was to capture 1.5 × 32px = 48px and
    // store it on the leaf.
    const html = `<div data-name="Card" style="position:relative; width:400px; height:200px; background:#FFF;">
      <div data-name="Headline" style="position:absolute; left:16px; top:16px; font-size:32px; font-weight:500;">Drift-free</div>
    </div>`;

    const { rendered } = await roundtrip(html);
    const subtree = textSubtreeFor(rendered, 'Headline');
    expect(subtree).toContain('line-height: 1.2;');
    expect(subtree).not.toContain('line-height: 48px');
  }, 30_000);

  it('text with an authored line-height keeps the authored value', async () => {
    const html = `<div data-name="Card" style="position:relative; width:400px; height:200px; background:#FFF;">
      <div data-name="Headline" style="position:absolute; left:16px; top:16px; font-size:32px; line-height:1.4;">Honored</div>
    </div>`;

    const { rendered } = await roundtrip(html);
    // Browser normalises 1.4 to px (32 × 1.4 = 44.8px). Either form is
    // acceptable — what we care about is that the value is NOT 1.2 (default).
    const subtree = textSubtreeFor(rendered, 'Headline');
    expect(subtree).toMatch(/line-height:\s*(?:1\.4|44\.8px|44px|45px)/);
    expect(subtree).not.toContain('line-height: 1.2');
  }, 30_000);
});

describe('round-trip: data-name survives both directions', () => {
  it('every authored layer name is round-trippable as data-name in the read-back', async () => {
    const html = `<div data-name="Card" style="position:relative; width:300px; height:200px; background:#EEE;">
      <div data-name="price-chip" style="position:absolute; left:24px; top:24px; width:120px; height:40px; background:#1B1B1A;"></div>
      <div data-name="caption" style="position:absolute; left:24px; top:80px; font-size:14px; color:#333;">Hello</div>
    </div>`;

    const { rendered, warnings } = await roundtrip(html);
    expect(warnings).toEqual([]);
    expect(rendered).toContain('data-name="Card"');
    expect(rendered).toContain('data-name="price-chip"');
    expect(rendered).toContain('data-name="caption"');
  }, 30_000);
});

describe('round-trip: positions are preserved', () => {
  it('rect positions match within 1px after a full round-trip', async () => {
    const html = `<div data-name="Stage" style="position:relative; width:400px; height:300px; background:#FFF;">
      <div data-name="Box" style="position:absolute; left:50px; top:80px; width:120px; height:60px; background:#F00;"></div>
    </div>`;

    const { shapes } = await roundtrip(html);
    const box = shapes.find((s) => s.name === 'Box');
    expect(box).toBeDefined();
    // 'Box' is a rect with absolute position from its parent. The page-absolute
    // x/y is `parent.x + 50` / `parent.y + 80`. Stage starts at (0, 0).
    expect(Math.round((box as Shape & { x: number }).x)).toBe(50);
    expect(Math.round((box as Shape & { y: number }).y)).toBe(80);
    expect(Math.round((box as Shape & { width: number }).width)).toBe(120);
    expect(Math.round((box as Shape & { height: number }).height)).toBe(60);
  }, 30_000);
});

describe('round-trip: text content matches', () => {
  it('the read-back HTML contains the same text the author wrote', async () => {
    const html = `<div data-name="Card" style="position:relative; width:400px; height:120px;">
      <div data-name="Greeting" style="position:absolute; left:16px; top:16px; font-size:18px;">Bienvenido</div>
    </div>`;

    const { rendered } = await roundtrip(html);
    expect(rendered).toContain('Bienvenido');
  }, 30_000);
});
