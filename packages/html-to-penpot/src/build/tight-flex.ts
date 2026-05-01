import type { MeasuredNode } from '../types';
import { parsePx } from './css';

/**
 * Detect text leaves that wrapped to multiple lines inside a flex *row*
 * container. The most common silent design defect we ship: a chip / strip
 * looks fine in the LLM's mental model ("4 bd · 3 ba · 2,840 sq ft") but the
 * browser shrinks the children to fit, the text content wraps, and the user
 * sees a two-line cell where they meant one.
 *
 * Conservative on purpose:
 *   - Skip text that explicitly carries a `\n` (the author wanted multi-line).
 *   - Skip column-direction containers (multi-line is the whole point).
 *   - Use a 1.5×line-height threshold so a slightly tall single line (font
 *     metrics descender, line-gap variance) doesn't trip the warning.
 *
 * Returns one warning per offending text node. Each warning names both the
 * text and its parent so the LLM can act without re-investigating.
 */
export function detectTightFlexRows(nodes: MeasuredNode[]): string[] {
  const warnings: string[] = [];
  for (const n of nodes) {
    if (n.textContent === undefined) continue;
    if (n.textContent.includes('\n')) continue;
    if (n.parentIndex === null) continue;
    // Synthesized chip-split children occupy the chip's inner content box by
    // design — their height is the parent's height, not a wrap signal.
    if (n._chipSplitChild) continue;

    const parent = nodes[n.parentIndex]!;
    const display = parent.computedStyle.display;
    if (display !== 'flex' && display !== 'inline-flex') continue;
    const dir = parent.computedStyle.flexDirection || 'row';
    if (dir !== 'row' && dir !== 'row-reverse') continue;

    const fontSize = parsePx(n.computedStyle.fontSize) ?? 14;
    const lineHeight = resolveLineHeightPx(n.computedStyle.lineHeight, fontSize);
    // 1.5× threshold catches a real second line (≈2× fontSize) without
    // tripping on font-metric variance (line-gap, descender clamp, …).
    if (n.rect.height > lineHeight * 1.5) {
      warnings.push(
        `Text "${preview(n.textContent)}" wrapped to multiple lines inside flex row ${labelOf(parent)}. ` +
          `Add more horizontal space (wider parent, smaller padding/gap, or shorter siblings) ` +
          `or set \`white-space: nowrap\` on the text leaf.`,
      );
    }
  }
  return warnings;
}

function preview(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 32 ? t.slice(0, 29) + '…' : t;
}

function labelOf(node: MeasuredNode): string {
  const name = node.dataAttrs['data-name'];
  return name ? `"${name}"` : `<${node.semanticTag}>`;
}

/**
 * Resolve a CSS `line-height` to a CSS-px value given the element's
 * `font-size`. Mirrors the browser's resolution rules: `normal` ≈ 1.2 × fs,
 * unitless ratio multiplies fs, percent multiplies fs, px is verbatim.
 */
function resolveLineHeightPx(lineHeight: string, fontSize: number): number {
  if (!lineHeight || lineHeight === 'normal') return fontSize * 1.2;
  const pxMatch = lineHeight.match(/^(-?\d+(?:\.\d+)?)px$/);
  if (pxMatch) return Number(pxMatch[1]);
  const percentMatch = lineHeight.match(/^(-?\d+(?:\.\d+)?)%$/);
  if (percentMatch) return (Number(percentMatch[1]) / 100) * fontSize;
  const ratio = Number(lineHeight);
  if (Number.isFinite(ratio)) return ratio * fontSize;
  return fontSize * 1.2;
}
