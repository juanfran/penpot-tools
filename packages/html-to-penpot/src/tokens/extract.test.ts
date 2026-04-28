import { describe, expect, it } from 'vitest';
import { tokensInInlineStyle } from './extract';

describe('tokensInInlineStyle', () => {
  it('returns empty when style has no var()', () => {
    const r = tokensInInlineStyle('background: #fff; color: red;');
    expect(r.appliedTokens).toEqual({});
    expect(r.tokenNames.size).toBe(0);
  });

  it('extracts a single fill token', () => {
    const r = tokensInInlineStyle('background-color: var(--brand-primary, #2E51C4);');
    expect(r.appliedTokens).toEqual({ fill: 'brand-primary' });
    expect([...r.tokenNames]).toEqual(['brand-primary']);
  });

  it('treats `background` shorthand as fill', () => {
    const r = tokensInInlineStyle('background: var(--accent, #f00);');
    expect(r.appliedTokens).toEqual({ fill: 'accent' });
  });

  it('maps color → fill for text leaves', () => {
    const r = tokensInInlineStyle('color: var(--fg, #000);');
    expect(r.appliedTokens).toEqual({ fill: 'fg' });
  });

  it('fans out border-radius shorthand to all 4 corners', () => {
    const r = tokensInInlineStyle('border-radius: var(--radius-md, 8px);');
    expect(r.appliedTokens).toEqual({
      r1: 'radius-md',
      r2: 'radius-md',
      r3: 'radius-md',
      r4: 'radius-md',
    });
  });

  it('targets per-corner radius slots', () => {
    const r = tokensInInlineStyle('border-top-left-radius: var(--rad-tl, 0px);');
    expect(r.appliedTokens).toEqual({ r1: 'rad-tl' });
  });

  it('fans out padding shorthand', () => {
    const r = tokensInInlineStyle('padding: var(--space-4, 16px);');
    expect(r.appliedTokens).toEqual({
      p1: 'space-4',
      p2: 'space-4',
      p3: 'space-4',
      p4: 'space-4',
    });
  });

  it('fans out gap to row and column', () => {
    const r = tokensInInlineStyle('gap: var(--gap-2, 8px);');
    expect(r.appliedTokens).toEqual({ rowGap: 'gap-2', columnGap: 'gap-2' });
  });

  it('combines multiple declarations', () => {
    const r = tokensInInlineStyle(
      'background: var(--brand-primary, #2E51C4); border-radius: var(--radius, 12px); padding: var(--p, 16px);',
    );
    expect(r.appliedTokens).toEqual({
      fill: 'brand-primary',
      r1: 'radius',
      r2: 'radius',
      r3: 'radius',
      r4: 'radius',
      p1: 'p',
      p2: 'p',
      p3: 'p',
      p4: 'p',
    });
    expect(r.tokenNames).toEqual(new Set(['brand-primary', 'radius', 'p']));
  });

  it('ignores declarations with var() in unmapped properties', () => {
    const r = tokensInInlineStyle('cursor: var(--never-mapped);');
    expect(r.appliedTokens).toEqual({});
    expect(r.tokenNames.has('never-mapped')).toBe(true);
  });

  it('strips the `--` prefix from token names', () => {
    const r = tokensInInlineStyle('background: var(--my-token);');
    expect([...r.tokenNames]).toEqual(['my-token']);
  });
});
