import { describe, expect, it } from 'vitest';
import { unwrapDocument } from './headless';

describe('unwrapDocument', () => {
  it('returns a fragment unchanged', () => {
    const html = '<div data-name="Card" style="width:100px;height:100px;">x</div>';
    expect(unwrapDocument(html)).toBe(html);
  });

  it('strips DOCTYPE / html / body wrappers and returns the body inner', () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;">
<div data-name="Card">x</div>
</body>
</html>`;
    expect(unwrapDocument(html)).toBe('<div data-name="Card">x</div>');
  });

  it('strips <html> when there is no <body>', () => {
    const html = '<html><div>x</div></html>';
    expect(unwrapDocument(html)).toBe('<div>x</div>');
  });

  it('handles uppercase tags', () => {
    const html = '<!DOCTYPE HTML><HTML><BODY><div>x</div></BODY></HTML>';
    expect(unwrapDocument(html)).toBe('<div>x</div>');
  });

  it('preserves nested body-like text inside attributes', () => {
    // Defensive: a fragment that *mentions* "body" in a data attribute should
    // not be misinterpreted.
    const html = '<div data-tag="body">x</div>';
    expect(unwrapDocument(html)).toBe(html);
  });
});
