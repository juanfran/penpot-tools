import { describe, expect, it } from 'vitest';
import {
  declToTailwind,
  resolveTagOverrides,
  type SemanticRule,
  slugifyName,
  stripDataAttrs,
  stylesToCssClasses,
  stylesToTailwind,
} from './shape-code';

function shape(id: string, name: string): { id: string; name: string } {
  return { id, name } as { id: string; name: string };
}

function rule(over: Partial<SemanticRule> & { type: SemanticRule['type'] }): SemanticRule {
  return {
    id: over.id ?? `r-${Math.random().toString(36).slice(2, 8)}`,
    type: over.type,
    value: over.value ?? '',
    tag: over.tag ?? 'button',
    enabled: over.enabled ?? true,
  };
}

describe('stylesToCssClasses', () => {
  it('uses the layer name as the class when available', () => {
    const html = `<div data-id="a" style="color: red; font-size: 14px"></div>`;
    const names = new Map([['a', 'Card']]);
    const { html: out, css } = stylesToCssClasses(html, 'class', names);
    expect(out).toBe(`<div data-id="a" class="card"></div>`);
    expect(css).toBe(`.card { color: red; font-size: 14px; }`);
  });

  it('slugifies weird names into safe class identifiers', () => {
    const html = `<div data-id="a" style="color: red"></div>`;
    const names = new Map([['a', 'Icons / token']]);
    const { html: out, css } = stylesToCssClasses(html, 'class', names);
    expect(out).toBe(`<div data-id="a" class="icons-token"></div>`);
    expect(css).toBe(`.icons-token { color: red; }`);
  });

  it('falls back to s-N when the layer has no usable name', () => {
    const html = `<div data-id="a" style="color: red"></div>`;
    const { html: out, css } = stylesToCssClasses(html, 'class', new Map());
    expect(out).toBe(`<div data-id="a" class="s-1"></div>`);
    expect(css).toBe(`.s-1 { color: red; }`);
  });

  it('deduplicates identical declarations across elements with different names', () => {
    const html =
      `<div data-id="a" style="color: red"></div>` +
      `<span data-id="b" style="color: red"></span>` +
      `<p data-id="c" style="color: blue"></p>`;
    const names = new Map([['a', 'Card'], ['b', 'Other'], ['c', 'Title']]);
    const { html: out, css } = stylesToCssClasses(html, 'class', names);
    // First element wins the slug; second reuses by decls match.
    expect(out).toBe(
      `<div data-id="a" class="card"></div>` +
        `<span data-id="b" class="card"></span>` +
        `<p data-id="c" class="title"></p>`,
    );
    expect(css).toBe(`.card { color: red; }\n.title { color: blue; }`);
  });

  it('uniquifies names that collide with different declarations', () => {
    const html =
      `<div data-id="a" style="color: red"></div>` +
      `<div data-id="b" style="color: blue"></div>`;
    const names = new Map([['a', 'Card'], ['b', 'Card']]);
    const { html: out, css } = stylesToCssClasses(html, 'class', names);
    expect(out).toBe(
      `<div data-id="a" class="card"></div>` +
        `<div data-id="b" class="card-2"></div>`,
    );
    expect(css).toBe(`.card { color: red; }\n.card-2 { color: blue; }`);
  });

  it('emits className when targeting JSX', () => {
    const html = `<div data-id="a" style="color: red"></div>`;
    const names = new Map([['a', 'Card']]);
    const { html: out } = stylesToCssClasses(html, 'className', names);
    expect(out).toBe(`<div data-id="a" className="card"></div>`);
  });

  it('decodes HTML entities so quoted font families round-trip', () => {
    const html = `<div data-id="a" style="font-family: &quot;Inter&quot;, sans-serif"></div>`;
    const { css } = stylesToCssClasses(html, 'class', new Map([['a', 'Title']]));
    expect(css).toBe(`.title { font-family: "Inter", sans-serif; }`);
  });

  it('drops empty style attributes instead of emitting an empty class', () => {
    const html = `<div data-id="a" data-type="frame" style=""></div>`;
    const { html: out, css } = stylesToCssClasses(html, 'class', new Map());
    expect(out).toBe(`<div data-id="a" data-type="frame"></div>`);
    expect(css).toBe('');
  });

  it('leaves untouched HTML alone when no style attributes exist', () => {
    const html = `<div data-id="a"><span>hi</span></div>`;
    const { html: out, css } = stylesToCssClasses(html, 'class', new Map());
    expect(out).toBe(html);
    expect(css).toBe('');
  });

  it('extracts styles from text leaves and names them after the parent class', () => {
    // The converter emits `<p>` / `<span>` inside `renderParagraph` without
    // any data-id. The orphan-style pass picks them up and derives a class
    // name from the nearest preceding `class="…"` so the agent gets a
    // descriptive class instead of an opaque `s-N`.
    const html =
      `<div data-id="a" data-type="frame" style="display: flex">` +
        `<p style="font-size: 16px; color: red">Hi</p>` +
      `</div>`;
    const { html: out, css } = stylesToCssClasses(html, 'class', new Map([['a', 'Card']]));
    expect(out).toBe(
      `<div data-id="a" data-type="frame" class="card">` +
        `<p class="card-text">Hi</p>` +
      `</div>`,
    );
    expect(css).toBe(
      `.card { display: flex; }\n.card-text { font-size: 16px; color: red; }`,
    );
  });

  it('falls back to s-N for text leaves with no preceding class', () => {
    const html = `<p style="color: red">Hi</p>`;
    const { html: out, css } = stylesToCssClasses(html, 'class', new Map());
    expect(out).toBe(`<p class="s-1">Hi</p>`);
    expect(css).toBe(`.s-1 { color: red; }`);
  });

  it('shares classes between data-id elements and orphan text leaves with identical styles', () => {
    const html =
      `<div data-id="a" style="color: red">` +
        `<p style="color: red">Hi</p>` +
      `</div>`;
    const { html: out, css } = stylesToCssClasses(html, 'class', new Map([['a', 'Card']]));
    expect(out).toBe(`<div data-id="a" class="card"><p class="card">Hi</p></div>`);
    expect(css).toBe(`.card { color: red; }`);
  });
});

describe('stripDataAttrs', () => {
  it('removes every data-* attribute from a tag', () => {
    const html = `<div data-id="abc" data-type="frame" data-name="Card" class="card"></div>`;
    expect(stripDataAttrs(html)).toBe(`<div class="card"></div>`);
  });

  it('strips data-* across nested elements', () => {
    const html =
      `<div data-id="a" class="card">` +
        `<span data-id="b" data-type="text" class="title">hi</span>` +
      `</div>`;
    expect(stripDataAttrs(html)).toBe(
      `<div class="card"><span class="title">hi</span></div>`,
    );
  });

  it('handles editor-only data-penpot-* attrs', () => {
    const html = `<div data-id="x" data-penpot-locked="true" data-penpot-blocked="true" class="x"></div>`;
    expect(stripDataAttrs(html)).toBe(`<div class="x"></div>`);
  });

  it('leaves non-data attributes alone', () => {
    const html = `<a href="/x" target="_blank" data-id="a" rel="noopener">x</a>`;
    expect(stripDataAttrs(html)).toBe(`<a href="/x" target="_blank" rel="noopener">x</a>`);
  });

  it('is a no-op when no data-* attrs exist', () => {
    const html = `<div class="card"><span>hi</span></div>`;
    expect(stripDataAttrs(html)).toBe(html);
  });
});

describe('slugifyName', () => {
  it.each([
    ['Card', 'card'],
    ['Hero Photo', 'hero-photo'],
    ['Icons / token', 'icons-token'],
    ['Hello World!!!', 'hello-world'],
    ['  Padded  ', 'padded'],
    ['multiple---dashes', 'multiple-dashes'],
    ['UPPERCASE', 'uppercase'],
  ])('"%s" → %s', (input, expected) => {
    expect(slugifyName(input)).toBe(expected);
  });

  it('returns null for empty / non-printable names so callers can fall back', () => {
    expect(slugifyName(undefined)).toBeNull();
    expect(slugifyName('')).toBeNull();
    expect(slugifyName('   ')).toBeNull();
    expect(slugifyName('!!!')).toBeNull();
  });

  it('prefixes a leading digit with `_` so the result is a valid CSS class', () => {
    expect(slugifyName('123 Card')).toBe('_123-card');
    expect(slugifyName('2x')).toBe('_2x');
  });
});

describe('stylesToTailwind', () => {
  it('translates a small inline style into a utility class string', () => {
    const html = `<div style="display: flex; flex-direction: column; gap: 8px"></div>`;
    expect(stylesToTailwind(html, 'class')).toBe(
      `<div class="flex flex-col gap-[8px]"></div>`,
    );
  });

  it('uses className when targeting JSX', () => {
    const html = `<div style="color: red"></div>`;
    expect(stylesToTailwind(html, 'className')).toBe(
      `<div className="text-[red]"></div>`,
    );
  });

  it('decodes HTML entities and substitutes whitespace in arbitrary values', () => {
    const html = `<div style="font-family: &quot;Inter&quot;, sans-serif"></div>`;
    // Quotes are stripped (Tailwind would otherwise reject the attribute);
    // spaces become `_` per Tailwind v4 arbitrary-value convention.
    expect(stylesToTailwind(html, 'class')).toBe(
      `<div class="font-[Inter,_sans-serif]"></div>`,
    );
  });

  it('drops style attributes with no parsable declarations', () => {
    const html = `<div style=""></div>`;
    expect(stylesToTailwind(html, 'class')).toBe(`<div></div>`);
  });

  it('preserves declaration order when emitting utilities', () => {
    const html = `<div style="position: absolute; left: 10px; top: 20px; width: 100px"></div>`;
    expect(stylesToTailwind(html, 'class')).toBe(
      `<div class="absolute left-[10px] top-[20px] w-[100px]"></div>`,
    );
  });
});

describe('declToTailwind — known mappings', () => {
  it.each([
    ['display', 'flex', 'flex'],
    ['display', 'grid', 'grid'],
    ['display', 'inline-block', 'inline-block'],
    ['display', 'none', 'hidden'],
    ['position', 'absolute', 'absolute'],
    ['position', 'sticky', 'sticky'],
    ['flex-direction', 'column', 'flex-col'],
    ['flex-direction', 'row-reverse', 'flex-row-reverse'],
    ['flex-wrap', 'wrap', 'flex-wrap'],
    ['justify-content', 'space-between', 'justify-between'],
    ['justify-content', 'flex-start', 'justify-start'],
    ['align-items', 'center', 'items-center'],
    ['align-items', 'flex-end', 'items-end'],
    ['align-self', 'flex-start', 'self-start'],
    ['width', '100%', 'w-full'],
    ['height', '100%', 'h-full'],
    ['width', 'auto', 'w-auto'],
    ['border-radius', '50%', 'rounded-full'],
    ['font-weight', '400', 'font-normal'],
    ['font-weight', '600', 'font-semibold'],
    ['font-weight', '700', 'font-bold'],
    ['font-style', 'italic', 'italic'],
    ['text-align', 'center', 'text-center'],
    ['text-transform', 'uppercase', 'uppercase'],
    ['white-space', 'nowrap', 'whitespace-nowrap'],
    ['overflow', 'hidden', 'overflow-hidden'],
    ['flex', '1', 'flex-1'],
    ['flex', 'none', 'flex-none'],
    ['flex-shrink', '0', 'shrink-0'],
    ['mix-blend-mode', 'multiply', 'mix-blend-multiply'],
    ['background-size', 'cover', 'bg-cover'],
    ['background-repeat', 'no-repeat', 'bg-no-repeat'],
  ])('%s: %s → %s', (prop, value, expected) => {
    expect(declToTailwind(prop, value)).toBe(expected);
  });
});

describe('declToTailwind — arbitrary values', () => {
  it('uses tailwind arbitrary-value syntax for numeric lengths', () => {
    expect(declToTailwind('width', '120px')).toBe('w-[120px]');
    expect(declToTailwind('top', '-4px')).toBe('top-[-4px]');
    expect(declToTailwind('gap', '8px')).toBe('gap-[8px]');
    expect(declToTailwind('padding', '16px')).toBe('p-[16px]');
    expect(declToTailwind('border-radius', '12px')).toBe('rounded-[12px]');
    expect(declToTailwind('font-size', '14px')).toBe('text-[14px]');
    expect(declToTailwind('letter-spacing', '0.1em')).toBe('tracking-[0.1em]');
    expect(declToTailwind('line-height', '1.4')).toBe('leading-[1.4]');
  });

  it('emits arbitrary colors and gradients without quoting', () => {
    expect(declToTailwind('background-color', '#ff0033')).toBe('bg-[#ff0033]');
    expect(declToTailwind('color', 'rgb(0, 0, 0)')).toBe('text-[rgb(0,_0,_0)]');
    expect(declToTailwind('background-image', 'linear-gradient(to right, red, blue)')).toBe(
      'bg-[image:linear-gradient(to_right,_red,_blue)]',
    );
  });

  it('routes box-shadow and transform through arbitrary syntax with whitespace folded', () => {
    expect(declToTailwind('box-shadow', '0 2px 8px rgba(0,0,0,0.1)')).toBe(
      'shadow-[0_2px_8px_rgba(0,0,0,0.1)]',
    );
    expect(declToTailwind('transform', 'translate(10px, 20px) rotate(7deg)')).toBe(
      '[transform:translate(10px,_20px)_rotate(7deg)]',
    );
  });

  it('falls back to the v4 arbitrary-property form for unknown CSS props', () => {
    expect(declToTailwind('caret-color', '#fff')).toBe('[caret-color:#fff]');
    expect(declToTailwind('grid-template-columns', '1fr 2fr')).toBe(
      '[grid-template-columns:1fr_2fr]',
    );
  });

  it('preserves z-index numerics inside arbitrary brackets', () => {
    expect(declToTailwind('z-index', '10')).toBe('z-[10]');
    expect(declToTailwind('opacity', '0.6')).toBe('opacity-[0.6]');
  });
});

describe('resolveTagOverrides', () => {
  it('returns an empty map when there are no rules', () => {
    const objects = { a: shape('a', 'Card') } as never;
    expect(resolveTagOverrides([], objects).size).toBe(0);
  });

  it('matches shape-id rules verbatim', () => {
    const objects = {
      a: shape('a', 'Card'),
      b: shape('b', 'Other'),
    } as never;
    const rules = [rule({ type: 'shape-id', value: 'a', tag: 'button' })];
    const out = resolveTagOverrides(rules, objects);
    expect(out.get('a')).toBe('button');
    expect(out.has('b')).toBe(false);
  });

  it('matches name-equals case-insensitively', () => {
    const objects = {
      a: shape('a', 'Login'),
      b: shape('b', 'login'),
      c: shape('c', 'Login Button'),
    } as never;
    const rules = [rule({ type: 'name-equals', value: 'login', tag: 'a' })];
    const out = resolveTagOverrides(rules, objects);
    expect(out.get('a')).toBe('a');
    expect(out.get('b')).toBe('a');
    // "Login Button" only contains "login", does not equal it.
    expect(out.has('c')).toBe(false);
  });

  it('matches name-contains case-insensitively', () => {
    const objects = {
      a: shape('a', 'Submit Button'),
      b: shape('b', 'BUTTON-primary'),
      c: shape('c', 'Card'),
    } as never;
    const rules = [rule({ type: 'name-contains', value: 'button', tag: 'button' })];
    const out = resolveTagOverrides(rules, objects);
    expect(out.get('a')).toBe('button');
    expect(out.get('b')).toBe('button');
    expect(out.has('c')).toBe(false);
  });

  it('applies precedence shape-id > name-equals > name-contains', () => {
    const objects = { a: shape('a', 'button') } as never;
    const rules = [
      rule({ type: 'name-contains', value: 'button', tag: 'span' }),
      rule({ type: 'name-equals', value: 'button', tag: 'a' }),
      rule({ type: 'shape-id', value: 'a', tag: 'button' }),
    ];
    expect(resolveTagOverrides(rules, objects).get('a')).toBe('button');
  });

  it('falls through to lower tiers when higher tiers do not match', () => {
    const objects = { a: shape('a', 'Submit Button') } as never;
    const rules = [
      rule({ type: 'shape-id', value: 'somewhere-else', tag: 'span' }),
      rule({ type: 'name-equals', value: 'button', tag: 'a' }),
      rule({ type: 'name-contains', value: 'button', tag: 'button' }),
    ];
    expect(resolveTagOverrides(rules, objects).get('a')).toBe('button');
  });

  it('honours the first match within a tier when multiple apply', () => {
    const objects = { a: shape('a', 'Big Button Card') } as never;
    const rules = [
      rule({ type: 'name-contains', value: 'button', tag: 'button' }),
      rule({ type: 'name-contains', value: 'card', tag: 'article' }),
    ];
    expect(resolveTagOverrides(rules, objects).get('a')).toBe('button');
  });

  it('ignores disabled rules', () => {
    const objects = { a: shape('a', 'Card') } as never;
    const rules = [
      rule({ type: 'shape-id', value: 'a', tag: 'button', enabled: false }),
    ];
    expect(resolveTagOverrides(rules, objects).size).toBe(0);
  });

  it('returns an empty map when all rules are disabled', () => {
    const objects = { a: shape('a', 'Card') } as never;
    const rules = [
      rule({ type: 'name-contains', value: 'card', tag: 'article', enabled: false }),
    ];
    expect(resolveTagOverrides(rules, objects).size).toBe(0);
  });
});
