/**
 * End-to-end coverage for the `shapeToCode` orchestrator. Loads a real
 * Penpot page fixture from `src/intengration/` (the same fixtures the
 * browser-mode visual-regression tests use) and asserts on the wiring
 * between `convertShape`, the post-processing transforms, and oxfmt.
 *
 * The browser-mode tests cover *visual* parity against screenshots; this
 * file runs in node and covers the *export* contract — class-based output,
 * data-* stripped, semantic tag overrides applied, etc.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Page, Shape, Uuid } from '../penpot.types';
import type { ConverterContext } from './types';
import { shapeToCode, type SemanticRule } from './shape-code';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'intengration');

async function loadPage(name: string): Promise<Page> {
  const raw = await readFile(join(FIXTURES_DIR, `${name}.json`), 'utf8');
  return JSON.parse(raw) as Page;
}

function topLevelShape(page: Page): Shape {
  const root = Object.values(page.objects).find((s) => s.parentId === s.id);
  if (!root) throw new Error('fixture has no root frame');
  const childId = (root as Shape & { shapes?: string[] }).shapes?.[0];
  if (!childId) throw new Error('fixture has no top-level shape');
  const shape = page.objects[childId];
  if (!shape) throw new Error(`shape ${childId} not in objects map`);
  return shape;
}

function makeCtx(): ConverterContext {
  return {
    resolveImageUrl: (id: Uuid) => `https://example.com/asset/${id}`,
  };
}

describe('shapeToCode — end-to-end against a real fixture', () => {
  it('produces class-based HTML with the data-* attrs stripped by default', async () => {
    const page = await loadPage('card');
    const shape = topLevelShape(page);

    const result = await shapeToCode(shape, page.objects, makeCtx(), {
      format: 'html',
      styling: 'css',
    });

    expect(result.code).not.toMatch(/\sstyle="/);
    expect(result.code).not.toMatch(/\sdata-id=/);
    expect(result.code).not.toMatch(/\sdata-type=/);
    expect(result.code).not.toMatch(/\sdata-name=/);
    expect(result.code).toMatch(/\sclass="[^"]+"/);
    // Standalone CSS block exists and is non-trivial.
    expect(result.css).toMatch(/^\.[a-z_][\w-]*\s*\{/m);
  });

  it('keeps data-* attrs when explicitly opted in', async () => {
    const page = await loadPage('card');
    const shape = topLevelShape(page);

    const result = await shapeToCode(shape, page.objects, makeCtx(), {
      format: 'html',
      styling: 'css',
      includeDataAttrs: true,
    });

    expect(result.code).toMatch(/\sdata-id="/);
    expect(result.code).toMatch(/\sdata-type="/);
  });

  it('emits Tailwind utility classes (and an empty css block) for styling=tailwind', async () => {
    const page = await loadPage('card');
    const shape = topLevelShape(page);

    const result = await shapeToCode(shape, page.objects, makeCtx(), {
      format: 'html',
      styling: 'tailwind',
    });

    expect(result.code).not.toMatch(/\sstyle="/);
    expect(result.css).toBe('');
    // Tailwind output for the card fixture relies on arbitrary values
    // (positions, sizes, custom colours) → at least one `[prop:value]`
    // bracket should appear in the class string.
    expect(result.code).toMatch(/class="[^"]*\[/);
  });

  it('emits JSX (className, no trailing semicolon) for format=jsx', async () => {
    const page = await loadPage('card');
    const shape = topLevelShape(page);

    const result = await shapeToCode(shape, page.objects, makeCtx(), {
      format: 'jsx',
      styling: 'css',
    });

    expect(result.code).toMatch(/\sclassName="/);
    expect(result.code).not.toMatch(/\sclass="/);
    // oxfmt would otherwise tail the JSX expression statement with `;`.
    expect(result.code).not.toMatch(/;\s*$/);
  });

  it('honours semantic-tag rules — a shape-id rule lifts the wrapper out of <div>', async () => {
    const page = await loadPage('card');
    const shape = topLevelShape(page);

    const rules: SemanticRule[] = [
      {
        id: 'rule-1',
        type: 'shape-id',
        value: shape.id,
        tag: 'button',
        enabled: true,
      },
    ];
    const result = await shapeToCode(shape, page.objects, makeCtx(), {
      format: 'html',
      styling: 'css',
      rules,
    });

    expect(result.code).toMatch(/<button[\s>]/);
  });

  it('returns the fonts referenced by the shape so callers can build @font-face', async () => {
    const page = await loadPage('card');
    const shape = topLevelShape(page);

    const result = await shapeToCode(shape, page.objects, makeCtx(), {
      format: 'html',
      styling: 'css',
    });

    expect(Array.isArray(result.fonts)).toBe(true);
    // The card fixture has text content; if it exposes any font, it must be
    // a well-formed FontInfo. (We don't assert the exact families because
    // fixture content can change.)
    for (const f of result.fonts) {
      expect(typeof f.fontFamily).toBe('string');
    }
  });
});
