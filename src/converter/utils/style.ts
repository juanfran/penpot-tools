/**
 * Converts a camelCase string to kebab-case.
 * Example: `backgroundColor` → `background-color`
 */
function toKebabCase(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

/**
 * Builds a CSS inline-style string from a plain object.
 *
 * Skips entries whose value is `null`, `undefined`, or an empty string.
 * Numeric values (including `0`) are included as-is. Keys are converted
 * from camelCase to kebab-case automatically.
 *
 * @example
 * buildStyle({ position: 'absolute', left: '10px', top: '20px' })
 * // → 'position: absolute; left: 10px; top: 20px;'
 */
export function buildStyle(
  props: Record<string, string | number | undefined | null>,
): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    parts.push(`${toKebabCase(key)}: ${value};`);
  }

  return parts.join(' ');
}

/**
 * Joins multiple partial CSS style strings into a single string.
 *
 * Trims each part and drops empty strings before joining with a space.
 *
 * @example
 * mergeStyles('left: 10px;', '', 'top: 20px;')
 * // → 'left: 10px; top: 20px;'
 */
export function mergeStyles(...parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join(' ');
}
