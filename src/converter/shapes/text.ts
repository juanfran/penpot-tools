import type {
  TextLeaf,
  ParagraphNode,
  TextShape,
  Typography,
} from '../../penpot.types';
import type { ConverterContext, FontInfo } from '../types';
import { tag } from '../utils/html';
import { cls, pxClass } from '../utils/tailwind';
import { mergeStyles } from '../utils/style';
import { hexOpacityToCss } from '../utils/color';
import { resolvePositionOutput } from '../visual/position';
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
    ? (FONT_WEIGHT_CLASS[resolved.fontWeight] ??
      `font-[${resolved.fontWeight}]`)
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

/**
 * Returns a Tailwind text color class for the first solid fill on a text leaf.
 * Uses arbitrary-value syntax: `text-[#RRGGBB]` (uppercase hex) or `text-[rgba(...)]`.
 */
export function textLeafColorClass(leaf: TextLeaf): string {
  const fills = leaf.fills;
  if (!fills || fills.length === 0) return '';
  const first = fills[0];
  if (!first.fillColor) return '';
  const cssColor = hexOpacityToCss(first.fillColor, first.fillOpacity);
  const displayColor = cssColor.startsWith('#') ? cssColor.toUpperCase() : cssColor;
  return `text-[${displayColor}]`;
}

/**
 * Renders a `ParagraphNode` as a `<p>` element.
 *
 * The first leaf's color is promoted to the paragraph level.
 * Leaves are wrapped in `<span>` only when their combined classes/style
 * differ from the paragraph's baseline.
 */
export function renderParagraph(para: ParagraphNode): string {
  const paraLeaf: TextLeaf = { text: '', ...para };
  const paraOutput = textLeafToClasses(paraLeaf);

  // Promote the first leaf's color to the paragraph level
  const firstLeaf = para.children[0];
  const paraColorClass = firstLeaf ? textLeafColorClass(firstLeaf) : '';
  const paraClasses = cls(paraOutput.classes, paraColorClass);

  const inner = para.children
    .map((leaf) => {
      const leafOutput = textLeafToClasses(leaf);
      const leafColorClass = textLeafColorClass(leaf);
      const leafClasses = cls(leafOutput.classes, leafColorClass);
      const leafStyle = leafOutput.style;

      // Skip span when leaf styling matches the paragraph baseline
      if (leafClasses === paraClasses && !leafStyle) return leaf.text;

      return tag(
        'span',
        { class: leafClasses || undefined, style: leafStyle || undefined },
        leaf.text,
      );
    })
    .join('');

  return tag(
    'p',
    {
      class: paraClasses || undefined,
      style: paraOutput.style || undefined,
    },
    inner,
  );
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

/**
 * Renders a `TextShape` as an absolutely-positioned `<div>` containing paragraphs.
 *
 * If `content` is null, renders an empty div with positioning only.
 */
export function renderText(shape: TextShape, ctx: ConverterContext): string {
  collectTextFonts(shape, ctx);
  const base = baseClasses(shape, ctx);
  const posOut = resolvePositionOutput(shape, ctx);

  const sizeClasses = cls(
    shape.width !== undefined ? pxClass('w', shape.width) : undefined,
    shape.height !== undefined ? pxClass('h', shape.height) : undefined,
  );

  const classes = cls(posOut.classes, sizeClasses, base.classes);
  const style = mergeStyles(posOut.style, base.style);

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
