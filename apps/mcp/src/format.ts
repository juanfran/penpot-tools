import type { PageHtmlBundle, ShapeHtmlBundle } from './convert.ts';

/**
 * The "do not paste verbatim, convert to the user's framework" guidance lives
 * in the server-level instructions and the `penpot://convert-guide` resource —
 * we don't repeat it on every call. Each block is omitted when empty so the
 * response stays minimal.
 */
function section(title: string, lang: string, body: string): string {
  if (!body) return '';
  return `\n## ${title}\n\`\`\`${lang}\n${body}\n\`\`\``;
}

export function describePageBundle(bundle: PageHtmlBundle, sourceLabel: string): string {
  return (
    `# ${sourceLabel} — page "${bundle.pageName}"` +
    section('tokensCss', 'css', bundle.tokensCss) +
    section('fontsCss', 'css', bundle.fontsCss) +
    section('html', 'html', bundle.html)
  );
}

export function describeShapeBundle(bundle: ShapeHtmlBundle): string {
  return describePageBundle(
    bundle,
    `Shape "${bundle.shapeName}" (${bundle.shapeType}, id ${bundle.shapeId})`,
  );
}
