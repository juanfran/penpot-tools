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

function lineHeightOf(style: PickedComputedStyle): string {
  // Browsers normalize `line-height` to px even when authored as a unitless
  // ratio. We pass it through as-is — the converter consumes either form.
  return style.lineHeight && style.lineHeight !== 'normal' ? style.lineHeight : '1.2';
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
 * Build a Penpot text `content` tree from a single text element. v1 emits a
 * single leaf inheriting the element's computed font styles. Multi-run text
 * (mixed `<span>` styling, `<br>` paragraph breaks) lands in Phase 2.
 */
export function buildTextContent(text: string, style: PickedComputedStyle): TextContent {
  const fontSizePx = parsePx(style.fontSize) ?? 14;

  const leaf: TextLeaf = {
    text,
    fontFamily: fontFamilyOf(style),
    fontSize: String(fontSizePx),
    fontWeight: style.fontWeight || '400',
    fontStyle: style.fontStyle || 'normal',
    lineHeight: lineHeightOf(style),
    letterSpacing: letterSpacingOf(style),
    textAlign: style.textAlign || 'left',
    textDecoration: 'none',
    textTransform: 'none',
    fills: leafFills(style),
  };

  const paragraph: ParagraphNode = {
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

  const paragraphSet: ParagraphSetNode = { type: 'paragraph-set', children: [paragraph] };
  return { type: 'root', verticalAlign: 'top', children: [paragraphSet] };
}
