import type {
  TextLeaf,
  ParagraphNode,
  TextShape,
  Typography,
} from '../../penpot.types';
import type { ConverterContext } from '../types';
import { tag } from '../utils/html';
import { cls, pxClass } from '../utils/tailwind';
import { mergeStyles } from '../utils/style';
import { hexOpacityToCss } from '../utils/color';
import {
  absolutePositionClasses,
  relativePositionClasses,
} from '../visual/position';
import { baseClasses } from '../visual/base';

const FONT_WEIGHT_CLASS: Record<string, string> = {
  '100': 'font-thin',
  '200': 'font-extralight',
  '300': 'font-light',
  '400': 'font-normal',
  '500': 'font-medium',
  '600': 'font-semibold',
  '700': 'font-bold',
  '800': 'font-extrabold',
  '900': 'font-black',
};

const TEXT_ALIGN_CLASS: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
  justify: 'text-justify',
};

/**
 * Converts a `TextLeaf`'s typography properties to Tailwind classes and inline styles.
 *
 * When `typographies` is provided and the leaf has a `typographyRefId`, the typography's
 * fields act as defaults — the leaf's own fields always take precedence (override).
 */
export function textLeafToClasses(
  leaf: TextLeaf,
  typographies?: Record<string, Typography>,
): { classes: string; style: string } {
  // Merge typography defaults under leaf overrides
  const resolved: Partial<Typography & TextLeaf> = {};
  if (typographies && leaf.typographyRefId) {
    const typo = typographies[leaf.typographyRefId];
    if (typo) Object.assign(resolved, typo);
  }
  Object.assign(resolved, leaf);

  const fontWeightClass = resolved.fontWeight
    ? (FONT_WEIGHT_CLASS[resolved.fontWeight] ?? `font-[${resolved.fontWeight}]`)
    : undefined;

  const classes = cls(
    resolved.fontSize ? pxClass('text', Number(resolved.fontSize)) : undefined,
    fontWeightClass,
    resolved.fontFamily ? `font-['${resolved.fontFamily}']` : undefined,
    resolved.lineHeight ? `leading-[${resolved.lineHeight}]` : undefined,
    resolved.textAlign ? TEXT_ALIGN_CLASS[resolved.textAlign] : undefined,
    resolved.fontStyle === 'italic' ? 'italic' : undefined,
    resolved.textDecoration === 'underline' ? 'underline' : undefined,
    resolved.textDecoration === 'line-through' ? 'line-through' : undefined,
    resolved.textTransform === 'uppercase' ? 'uppercase' : undefined,
    resolved.textTransform === 'lowercase' ? 'lowercase' : undefined,
    resolved.textTransform === 'capitalize' ? 'capitalize' : undefined,
  );

  const styleParts: string[] = [];
  if (resolved.letterSpacing && resolved.letterSpacing !== '0')
    styleParts.push(`letter-spacing: ${resolved.letterSpacing}em;`);

  return { classes, style: styleParts.join(' ') };
}

const NAMED_COLOR_CLASS: Record<string, string> = {
  '#ffffff': 'text-white',
  '#000000': 'text-black',
};

/**
 * Returns a Tailwind text color class for the first solid fill on a text leaf.
 * Maps common colors (#ffffff, #000000) to named Tailwind classes.
 */
export function textLeafColorClass(leaf: TextLeaf): string {
  const fills = leaf.fills;
  if (!fills || fills.length === 0) return '';
  const first = fills[0];
  if (!first.fillColor) return '';
  const cssColor = hexOpacityToCss(first.fillColor, first.fillOpacity);
  return NAMED_COLOR_CLASS[cssColor.toLowerCase()] ?? `text-[${cssColor}]`;
}

/**
 * Renders a `ParagraphNode` as a `<p>` element.
 *
 * Paragraph-level styles act as defaults. Each leaf is wrapped in a `<span>`
 * with its own classes/styles when they differ from the paragraph defaults.
 */
export function renderParagraph(para: ParagraphNode): string {
  const paraLeaf: TextLeaf = { text: '', ...para };
  const paraOutput = textLeafToClasses(paraLeaf);

  const inner = para.children
    .map((leaf) => {
      const leafOutput = textLeafToClasses(leaf);
      const colorClass = textLeafColorClass(leaf);
      const spanClasses = cls(leafOutput.classes, colorClass);
      const spanStyle = leafOutput.style;

      if (!spanClasses && !spanStyle) return leaf.text;
      return tag(
        'span',
        { class: spanClasses || undefined, style: spanStyle || undefined },
        leaf.text,
      );
    })
    .join('');

  return tag(
    'p',
    {
      class: paraOutput.classes || undefined,
      style: paraOutput.style || undefined,
    },
    inner,
  );
}

/**
 * Renders a `TextShape` as an absolutely-positioned `<div>` containing paragraphs.
 *
 * If `content` is null, renders an empty div with positioning only.
 */
export function renderText(shape: TextShape, ctx: ConverterContext): string {
  const base = baseClasses(shape, ctx);

  const posClasses = ctx._parentIsLayout
    ? ''
    : ctx._forceRelative
      ? relativePositionClasses(shape)
      : absolutePositionClasses(shape, ctx._isChildOfRoot);
  const sizeClasses = cls(
    shape.width !== undefined ? pxClass('w', shape.width) : undefined,
    shape.height !== undefined ? pxClass('h', shape.height) : undefined,
  );

  const classes = cls(posClasses, sizeClasses, base.classes);
  const style = mergeStyles(base.style);

  let inner = '';
  if (shape.content) {
    inner = shape.content.children
      .flatMap((set) => set.children)
      .map(renderParagraph)
      .join('');
  }

  return tag(
    'div',
    {
      'data-id': shape.id,
      class: classes || undefined,
      style: style || undefined,
    },
    inner,
  );
}
