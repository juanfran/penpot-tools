import type { TextLeaf, ParagraphNode, TextShape, Typography } from '../../penpot.types';
import type { ConverterContext, FontInfo } from '../types';
import { tag } from '../utils/html';
import { px } from '../utils/css';
import { mergeStyles } from '../utils/style';
import { hexOpacityToCss } from '../utils/color';
import { tokenToCssVar } from '../tokens';
import { resolvePositionOutput } from '../visual/position';
import { baseStyles } from '../visual/base';

export function textLeafToStyles(
  leaf: TextLeaf,
  typographies?: Record<string, Typography>,
): string {
  const resolved: Partial<Typography & TextLeaf> = {};
  if (typographies && leaf.typographyRefId) {
    const typo = typographies[leaf.typographyRefId];
    if (typo) Object.assign(resolved, typo);
  }
  Object.assign(resolved, leaf);

  const parts: string[] = [];

  if (resolved.fontSize) parts.push(`font-size: ${px(Number(resolved.fontSize))};`);
  if (resolved.fontWeight) parts.push(`font-weight: ${resolved.fontWeight};`);
  if (resolved.fontFamily) {
    const fontFamily = resolved.fontFamily.replace(/^["']|["']$/g, '');
    parts.push(`font-family: '${fontFamily}';`);
  }
  if (resolved.lineHeight) parts.push(`line-height: ${resolved.lineHeight};`);
  if (resolved.textAlign) parts.push(`text-align: ${resolved.textAlign};`);
  if (resolved.fontStyle === 'italic') parts.push('font-style: italic;');
  if (resolved.textDecoration === 'underline') parts.push('text-decoration: underline;');
  if (resolved.textDecoration === 'line-through') parts.push('text-decoration: line-through;');
  if (resolved.textTransform) parts.push(`text-transform: ${resolved.textTransform};`);
  if (resolved.letterSpacing && resolved.letterSpacing !== '0') {
    parts.push(`letter-spacing: ${resolved.letterSpacing}px;`);
  }

  return parts.join(' ');
}

export function textLeafColorStyle(
  leaf: TextLeaf,
  fillTokenName?: string,
  tokens?: Map<string, string>,
  fallbackColor?: string,
): string {
  if (fillTokenName) return `color: ${tokenToCssVar(fillTokenName, tokens)};`;
  const fills = leaf.fills;
  if (!fills || fills.length === 0) {
    return fallbackColor ? `color: ${fallbackColor};` : '';
  }
  const first = fills[0];
  if (!first.fillColor) return fallbackColor ? `color: ${fallbackColor};` : '';
  const cssColor = hexOpacityToCss(first.fillColor, first.fillOpacity);
  return `color: ${cssColor};`;
}

export function renderParagraph(
  para: ParagraphNode,
  fillTokenName?: string,
  tokens?: Map<string, string>,
  fallbackColor?: string,
): string {
  const paraLeaf: TextLeaf = { text: '', ...para };
  const paraBaseStyle = textLeafToStyles(paraLeaf);
  const firstLeaf = para.children[0];
  const paraColorStyle = firstLeaf
    ? textLeafColorStyle(firstLeaf, fillTokenName, tokens, fallbackColor)
    : '';
  const paraStyle = mergeStyles(paraBaseStyle, paraColorStyle);

  const inner = para.children
    .map((leaf) => {
      const leafBaseStyle = textLeafToStyles(leaf);
      const leafColorStyle = textLeafColorStyle(leaf, fillTokenName, tokens, fallbackColor);
      const leafStyle = mergeStyles(leafBaseStyle, leafColorStyle);

      if (leafStyle === paraStyle) return leaf.text;

      return tag('span', { style: leafStyle || undefined }, leaf.text);
    })
    .join('');

  return tag('p', { style: paraStyle || undefined }, inner);
}

function collectLeafFont(
  leaf: TextLeaf,
  collector: Map<string, FontInfo>,
  typographies?: Record<string, Typography>,
): void {
  const resolved: Partial<Typography & TextLeaf> = {};
  if (typographies && leaf.typographyRefId) {
    const typo = typographies[leaf.typographyRefId];
    if (typo) Object.assign(resolved, typo);
  }
  Object.assign(resolved, leaf);

  if (!resolved.fontFamily) return;
  const key = `${resolved.fontFamily}|${resolved.fontWeight ?? ''}|${resolved.fontStyle ?? ''}`;
  if (!collector.has(key)) {
    collector.set(key, {
      fontFamily: resolved.fontFamily,
      fontWeight: resolved.fontWeight,
      fontStyle: resolved.fontStyle,
    });
  }
}

function collectTextFonts(
  shape: TextShape,
  ctx: ConverterContext,
  typographies?: Record<string, Typography>,
): void {
  if (!ctx._fontCollector || !shape.content) return;
  for (const set of shape.content.children) {
    for (const para of set.children) {
      collectLeafFont({ text: '', ...para }, ctx._fontCollector, typographies);
      for (const leaf of para.children) {
        collectLeafFont(leaf, ctx._fontCollector, typographies);
      }
    }
  }
}

export function renderText(shape: TextShape, ctx: ConverterContext): string {
  collectTextFonts(shape, ctx);
  const base = baseStyles(shape, ctx);
  const posStyle = resolvePositionOutput(shape, ctx);

  const sizeParts: string[] = [];
  if (shape.width !== undefined) sizeParts.push(`width: ${px(shape.width)};`);
  if (shape.height !== undefined) sizeParts.push(`height: ${px(shape.height)};`);
  const sizeStyle = sizeParts.join(' ');

  const noWrapStyle = shape.growType === 'auto-width' ? 'white-space: nowrap;' : '';

  const verticalAlign = shape.content?.verticalAlign;
  const verticalAlignStyle =
    verticalAlign === 'center'
      ? 'display: flex; flex-direction: column; justify-content: center;'
      : verticalAlign === 'bottom'
        ? 'display: flex; flex-direction: column; justify-content: flex-end;'
        : '';

  const style = ctx._parentIsLayout
    ? mergeStyles(posStyle, noWrapStyle, verticalAlignStyle, base)
    : mergeStyles(posStyle, sizeStyle, noWrapStyle, verticalAlignStyle, base);

  const fillTokenName = shape.appliedTokens?.fill;

  const shapeHasFill = (shape.fills ?? []).some((f) => f.fillColor);
  const firstStroke = (shape.strokes ?? [])[0];
  const strokeFallbackColor =
    !shapeHasFill && firstStroke?.strokeColor
      ? hexOpacityToCss(firstStroke.strokeColor, firstStroke.strokeOpacity)
      : undefined;

  let inner = '';
  if (shape.content) {
    inner = shape.content.children
      .flatMap((set) => set.children)
      .map((para) => renderParagraph(para, fillTokenName, ctx.tokens, strokeFallbackColor))
      .join('');
  }

  return tag(
    'div',
    { 'data-id': shape.id, 'data-type': shape.type, style: style || undefined },
    inner,
  );
}
