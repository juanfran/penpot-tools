import { describe, it, expect } from 'vitest';
import { escapeHtml, tag } from './html';

describe('escapeHtml', () => {
  it('returns plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes less-than', () => {
    expect(escapeHtml('a < b')).toBe('a &lt; b');
  });

  it('escapes greater-than', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#x27;s');
  });

  it('escapes all special chars in one string', () => {
    expect(escapeHtml('<script>alert("xss & \'hack\'")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss &amp; &#x27;hack&#x27;&quot;)&lt;/script&gt;',
    );
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('tag', () => {
  it('builds a simple open/close tag with no attributes', () => {
    expect(tag('div', {}, 'hello')).toBe('<div>hello</div>');
  });

  it('builds a self-closing tag when children is undefined', () => {
    expect(tag('img', { src: 'image.png' })).toBe('<img src="image.png" />');
  });

  it('builds a self-closing tag when children is undefined and no attrs', () => {
    expect(tag('br', {})).toBe('<br />');
  });

  it('includes attributes in the tag', () => {
    expect(tag('div', { id: 'foo', class: 'bar' }, 'content')).toBe(
      '<div id="foo" class="bar">content</div>',
    );
  });

  it('omits attributes with undefined values', () => {
    expect(
      tag('div', { id: 'foo', class: undefined, style: 'color:red' }, 'hi'),
    ).toBe('<div id="foo" style="color:red">hi</div>');
  });

  it('escapes attribute values', () => {
    expect(tag('div', { title: 'a "quoted" value' }, 'text')).toBe(
      '<div title="a &quot;quoted&quot; value">text</div>',
    );
  });

  it('allows empty children (renders open/close tag)', () => {
    expect(tag('div', {}, '')).toBe('<div></div>');
  });

  it('allows nested tags as children', () => {
    const inner = tag('span', { class: 'inner' }, 'text');
    expect(tag('div', { class: 'outer' }, inner)).toBe(
      '<div class="outer"><span class="inner">text</span></div>',
    );
  });

  it('handles data attributes with penpot IDs', () => {
    expect(tag('div', { 'data-penpot-id': 'abc-123' }, 'content')).toBe(
      '<div data-penpot-id="abc-123">content</div>',
    );
  });
});
