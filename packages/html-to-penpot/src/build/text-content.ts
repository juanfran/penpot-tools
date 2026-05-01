import type {
  Fill,
  HexColor,
  ParagraphNode,
  ParagraphSetNode,
  TextContent,
  TextLeaf,
} from '@penpot-tools/converter/types';
import type { PickedComputedStyle } from '../types';
import { parseColor, parsePx } from '../build/css';

function fontFamilyOf(style: PickedComputedStyle): string {
  // getComputedStyle returns the resolved family list (possibly with quotes).
  // Penpot expects a single family name; pick the first.
  const first = style.fontFamily.split(',')[0]?.trim() ?? 'sans-serif';
  return first.replace(/^["']|["']$/g, '');
}

function lineHeightOf(style: PickedComputedStyle, inlineStyle?: string): string {
  // The headless mount applies a Tailwind-style preflight that cascades
  // `line-height: 1.5` down to every element, so the *computed* line-height is
  // always set even when the author didn't ask for one. Storing that inflated
  // value silently changes the text shape's height on round-trip (a 16px font
  // becomes 24px tall instead of ~19px). Trust the computed value only when
  // the author explicitly opted in via the element's own inline style; fall
  // back to '1.2' otherwise so the read-mode converter emits a sane default.
  const inlineHasLineHeight =
    inlineStyle !== undefined && /(?:^|;)\s*line-height\s*:/i.test(inlineStyle);
  if (inlineHasLineHeight && style.lineHeight && style.lineHeight !== 'normal') {
    return style.lineHeight;
  }
  return '1.2';
}

/**
 * Penpot stores `letterSpacing` as a unitless number string and the converter
 * appends `px` on output. The browser serialises computed letter-spacing as
 * `"<n>px"`, so we strip the unit before storing — otherwise the round-trip
 * yields `"-6pxpx"`.
 */
function letterSpacingOf(style: PickedComputedStyle): string {
  const raw = style.letterSpacing;
  if (!raw || raw === 'normal') return '0';
  const px = parsePx(raw);
  if (px !== null) return String(px);
  // Already unitless (or some other form) — leave as-is.
  return raw;
}

function leafFills(style: PickedComputedStyle): Fill[] {
  const c = parseColor(style.color);
  if (!c) return [{ fillColor: '#000000' as HexColor, fillOpacity: 1 }];
  return [{ fillColor: c.hex, fillOpacity: c.opacity }];
}

/**
 * Pre-apply CSS `text-transform` to the stored text. Browsers apply the
 * transform at render time, so `Element.textContent` returns the authored
 * characters — but Penpot's text engine treats `textTransform` as a hint
 * only on the leaf and the read-mode converter erases it. Storing the
 * already-transformed string keeps the rendered glyphs faithful even after
 * the file is edited or re-exported.
 */
function applyTextTransform(text: string, transform: string): string {
  switch (transform) {
    case 'uppercase':
      return text.toUpperCase();
    case 'lowercase':
      return text.toLowerCase();
    case 'capitalize':
      // CSS capitalize uppercases the first letter of each whitespace-
      // delimited word — keep the rest of each word unchanged.
      return text.replace(/(^|\s)(\S)/g, (_, lead, ch) => lead + ch.toUpperCase());
    default:
      return text;
  }
}

/**
 * Build a Penpot text `content` tree from a single text element.
 *
 * Text containing `\n` (typically produced by the walker when an element has
 * `<br>` line breaks) is split into one paragraph per line — Penpot's text
 * engine renders paragraphs stacked vertically, which is exactly what `<br>`
 * does visually.
 *
 * `verticalAlign` is set by the chip-split pipeline when the synthesized text
 * sits inside a flex parent that asks for vertical centring (icon buttons,
 * avatar circles). Defaults to `'top'` so plain text leaves are unchanged.
 */
export function buildTextContent(
  text: string,
  style: PickedComputedStyle,
  opts: { verticalAlign?: 'top' | 'center' | 'bottom'; inlineStyle?: string } = {},
): TextContent {
  const fontSizePx = parsePx(style.fontSize) ?? 14;
  const transformedText = applyTextTransform(text, style.textTransform || 'none');

  const sharedLeafStyle = {
    fontFamily: fontFamilyOf(style),
    fontSize: String(fontSizePx),
    fontWeight: style.fontWeight || '400',
    fontStyle: style.fontStyle || 'normal',
    lineHeight: lineHeightOf(style, opts.inlineStyle),
    letterSpacing: letterSpacingOf(style),
    textAlign: style.textAlign || 'left',
    textDecoration: 'none' as const,
    textTransform: 'none' as const,
    fills: leafFills(style),
  };

  // Empty leaf-line still needs a leaf so Penpot's renderer reserves the line
  // height — important for `text\n\nmore` to render the blank line.
  // `String.split` always returns at least one element, so the cast to the
  // non-empty tuple type is safe.
  const lines = transformedText.split('\n');
  const paragraphs = lines.map((line): ParagraphNode => {
    const leaf: TextLeaf = { text: line, ...sharedLeafStyle };
    return {
      type: 'paragraph',
      children: [leaf],
      fontFamily: leaf.fontFamily,
      fontSize: leaf.fontSize,
      fontWeight: leaf.fontWeight,
      fontStyle: leaf.fontStyle,
      lineHeight: leaf.lineHeight,
      letterSpacing: leaf.letterSpacing,
      textAlign: leaf.textAlign,
    };
  }) as [ParagraphNode, ...ParagraphNode[]];

  const paragraphSet: ParagraphSetNode = { type: 'paragraph-set', children: paragraphs };
  return { type: 'root', verticalAlign: opts.verticalAlign ?? 'top', children: [paragraphSet] };
}
