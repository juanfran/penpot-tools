import type { PageHtmlBundle, ShapeHtmlBundle } from './convert.ts';

export function describePageBundle(bundle: PageHtmlBundle, sourceLabel: string): string {
  return [
    `# Penpot HTML — ${sourceLabel} (page: ${bundle.pageName})`,
    '',
    'Reminder: this is raw inline-styled HTML from the penpot-tools converter.',
    "Convert it into idiomatic, semantic markup for the user's target framework",
    '(see the server instructions). Do not paste verbatim.',
    '',
    '## tokensCss',
    bundle.tokensCss ? '```css\n' + bundle.tokensCss + '\n```' : '_(no design tokens applied)_',
    '',
    '## fontsCss',
    bundle.fontsCss ? '```css\n' + bundle.fontsCss + '\n```' : '_(no custom fonts)_',
    '',
    '## html',
    '```html',
    bundle.html,
    '```',
  ].join('\n');
}

export function describeShapeBundle(bundle: ShapeHtmlBundle): string {
  return describePageBundle(
    bundle,
    `selected shape "${bundle.shapeName}" (${bundle.shapeType}, id ${bundle.shapeId})`,
  );
}
