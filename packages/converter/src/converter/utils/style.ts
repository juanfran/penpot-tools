/**
 * Joins multiple partial CSS style strings into a single string.
 *
 * Trims each part and drops empty strings before joining with a space.
 * Multiple `box-shadow` declarations are merged into a single comma-separated
 * property so neither value is silently dropped.
 * Multiple `transform` declarations are merged into a single space-separated
 * value so positional translate and rotation/matrix transforms coexist.
 *
 * @example
 * mergeStyles('left: 10px;', '', 'top: 20px;')
 * // → 'left: 10px; top: 20px;'
 *
 * mergeStyles('box-shadow: 0 2px 4px #000;', 'box-shadow: inset 0 0 0 2px red;')
 * // → 'box-shadow: 0 2px 4px #000, inset 0 0 0 2px red;'
 *
 * mergeStyles('transform: translate(10px, 20px);', 'transform: rotate(45deg);')
 * // → 'transform: translate(10px, 20px) rotate(45deg);'
 */
export function mergeStyles(...parts: string[]): string {
  const filtered = parts.map((p) => p.trim()).filter((p) => p.length > 0);

  const boxShadowValues: string[] = [];
  const transformValues: string[] = [];
  const rest: string[] = [];

  for (const part of filtered) {
    const bsMatch = /^box-shadow:\s*(.+?);?$/.exec(part);
    const tfMatch = /^transform:\s*(.+?);?$/.exec(part);
    if (bsMatch) {
      boxShadowValues.push(bsMatch[1].trim());
    } else if (tfMatch) {
      transformValues.push(tfMatch[1].trim());
    } else {
      rest.push(part);
    }
  }

  if (boxShadowValues.length > 0) {
    rest.push(`box-shadow: ${boxShadowValues.join(', ')};`);
  }
  if (transformValues.length > 0) {
    rest.push(`transform: ${transformValues.join(' ')};`);
  }

  return rest.join(' ');
}
