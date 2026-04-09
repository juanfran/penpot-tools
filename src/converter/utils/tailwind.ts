/**
 * Formats a numeric pixel value as a Tailwind arbitrary-value token.
 *
 * Rounds to 2 decimal places and omits the decimal portion when it is zero.
 * Example: `px(120)` → `[120px]`, `px(12.5)` → `[12.5px]`
 */
export function px(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const formatted =
    rounded % 1 === 0
      ? String(rounded | 0)
      : rounded.toFixed(2).replace(/\.?0+$/, '');
  return `[${formatted}px]`;
}

/**
 * Builds a Tailwind arbitrary-value class for a given prefix and pixel value.
 *
 * Example: `pxClass('w', 120)` → `w-[120px]`
 */
export function pxClass(prefix: string, value: number): string {
  return `${prefix}-${px(value)}`;
}

/**
 * Builds a Tailwind class string from an array of conditional tokens.
 *
 * Filters out falsy values (false, undefined, null, empty string) and joins
 * the remaining tokens with a single space. Mirrors the `clsx`/`cx` pattern.
 *
 * Multiple `shadow-[...]` arbitrary classes are automatically merged into a
 * single comma-separated value so that box-shadows from different sources
 * (e.g. drop-shadow + outer stroke) coexist correctly.
 *
 * Example: `cls('flex', false, 'items-center')` → `'flex items-center'`
 * Example: `cls('shadow-[2px_2px_#000]', 'shadow-[0_0_0_2px_red]')`
 *          → `'shadow-[2px_2px_#000,0_0_0_2px_red]'`
 */
export function cls(...tokens: (string | false | undefined | null)[]): string {
  const all = tokens
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
    .flatMap((t) => t.split(/\s+/))
    .filter(Boolean);

  const shadowValues: string[] = [];
  const rest: string[] = [];

  for (const c of all) {
    const m = /^shadow-\[(.+)\]$/.exec(c);
    if (m) shadowValues.push(m[1]);
    else rest.push(c);
  }

  if (shadowValues.length > 0) {
    rest.push(`shadow-[${shadowValues.join(',')}]`);
  }

  return rest.join(' ');
}
