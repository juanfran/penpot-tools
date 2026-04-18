import type { FontInfo } from '../types';

export function buildGoogleFontsUrls(fonts: readonly FontInfo[]): string[] {
  const grouped = new Map<string, Set<string>>();

  for (const font of fonts) {
    const family = font.fontFamily
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .trim()
      .replace(/\s+/g, ' ');

    const weight = String(font.fontWeight).trim();
    const ital = font.fontStyle === 'italic' ? 1 : 0;

    if (!grouped.has(family)) {
      grouped.set(family, new Set());
    }

    grouped.get(family)!.add(`${ital},${weight}`);
  }

  return Array.from(grouped.entries()).map(([family, variants]) => {
    const parsedVariants = Array.from(variants)
      .map((variant) => {
        const [ital, weight] = variant.split(',');
        return {
          ital: Number(ital),
          weight: Number(weight),
        };
      })
      .sort((a, b) => a.ital - b.ital || a.weight - b.weight);

    const hasItalic = parsedVariants.some((v) => v.ital === 1);
    const familyParam = encodeURIComponent(family).replace(/%20/g, '+');

    const variantParam = hasItalic
      ? parsedVariants.map((v) => `${v.ital},${v.weight}`).join(';')
      : parsedVariants.map((v) => `${v.weight}`).join(';');

    const axis = hasItalic ? ':ital,wght@' : ':wght@';

    return `https://fonts.googleapis.com/css2?family=${familyParam}${axis}${variantParam}&display=swap`;
  });
}
