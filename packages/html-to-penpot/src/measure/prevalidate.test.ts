import { describe, expect, it } from 'vitest';
import { prevalidateHtml } from './prevalidate';

describe('prevalidateHtml', () => {
  it('errors on empty fragment', () => {
    const result = prevalidateHtml('');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!).toContain('Empty HTML');
  });

  it('errors on whitespace-only fragment', () => {
    const result = prevalidateHtml('   \n\n  \t  ');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('errors on a comment-only fragment', () => {
    const result = prevalidateHtml('<!-- empty -->');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('errors on text-only fragment (no element wrapper)', () => {
    const result = prevalidateHtml('Just some text');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!).toContain('no element');
  });

  it('passes a fragment with at least one element', () => {
    const result = prevalidateHtml('<div style="width:200px">x</div>');
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('strips the document wrapper before checking', () => {
    const result = prevalidateHtml(
      '<!DOCTYPE html><html><body><div data-name="Card">x</div></body></html>',
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});
