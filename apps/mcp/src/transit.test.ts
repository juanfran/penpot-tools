import { describe, expect, it } from 'vitest';
import { encode, tk, toTransitJson, tset, tu } from './transit';

describe('transit encode', () => {
  it('encodes scalars verbatim', () => {
    expect(encode(1)).toBe(1);
    expect(encode('hello')).toBe('hello');
    expect(encode(true)).toBe(true);
    expect(encode(null)).toBe(null);
    expect(encode(undefined)).toBe(null);
  });

  it('encodes keywords with ~: prefix', () => {
    expect(encode(tk('id'))).toBe('~:id');
    expect(encode(tk('set-tokens-lib'))).toBe('~:set-tokens-lib');
  });

  it('encodes UUIDs with ~u prefix', () => {
    expect(encode(tu('00000000-0000-0000-0000-000000000000'))).toBe(
      '~u00000000-0000-0000-0000-000000000000',
    );
  });

  it('encodes sets as ~#set', () => {
    expect(encode(tset(['a', 'b']))).toEqual(['~#set', ['a', 'b']]);
  });

  it('escapes strings starting with ~ ^ or `', () => {
    expect(encode('~hi')).toBe('~~hi');
    expect(encode('^x')).toBe('~^x');
    expect(encode('`x')).toBe('~`x');
  });

  it('encodes maps with the ^ cache marker', () => {
    expect(encode({ a: 1, b: 'x' })).toEqual(['^ ', 'a', 1, 'b', 'x']);
  });

  it('treats `:` keys as Transit keywords', () => {
    expect(encode({ ':id': 'foo' })).toEqual(['^ ', '~:id', 'foo']);
  });

  it('preserves $ in nested map keys (the whole point of using transit)', () => {
    const tree = { theme: { primary: { $type: 'color', $value: '#fff' } } };
    expect(toTransitJson(tree)).toContain('"$type"');
    expect(toTransitJson(tree)).toContain('"$value"');
  });

  it('encodes arrays element-by-element', () => {
    expect(encode([1, tk('x'), { ':k': 2 }])).toEqual([1, '~:x', ['^ ', '~:k', 2]]);
  });

  it('produces deterministic JSON output for an update-file body', () => {
    const body = {
      ':id': tu('11111111-1111-1111-1111-111111111111'),
      ':revn': 0,
      ':changes': [{ ':type': tk('set-tokens-lib'), ':tokens-lib': { theme: {} } }],
    };
    const out = JSON.parse(toTransitJson(body));
    expect(out).toEqual([
      '^ ',
      '~:id',
      '~u11111111-1111-1111-1111-111111111111',
      '~:revn',
      0,
      '~:changes',
      [['^ ', '~:type', '~:set-tokens-lib', '~:tokens-lib', ['^ ', 'theme', ['^ ']]]],
    ]);
  });
});
