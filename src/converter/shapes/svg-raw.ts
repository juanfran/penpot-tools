import type { SvgRawShape } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { cls } from '../utils/tailwind';
import { mergeStyles } from '../utils/style';
import { resolvePositionOutput } from '../visual/position';
import { baseClasses } from '../visual/base';

/**
 * Strips `<script>` elements and `on*` event attributes from raw SVG content
 * to prevent XSS injection when embedding untrusted SVG markup.
 */
function sanitizeSvg(content: string): string {
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '');
}

/**
 * Renders a Penpot `SvgRawShape` as a `<div>` wrapping the raw SVG content.
 *
 * The wrapper div is absolutely positioned and sized to the shape bounding box.
 * The raw SVG content is sanitized to strip `<script>` tags and `on*` event
 * attributes before embedding.
 *
 * The `data-id` attribute carries the Penpot shape ID.
 */
export function renderSvgRaw(shape: SvgRawShape, ctx: ConverterContext): string {
  const base = baseClasses(shape, ctx);
  const safeContent = sanitizeSvg(shape.content);
  const posOut = resolvePositionOutput(shape, ctx);

  const classes = cls(posOut.classes, base.classes);
  const style = mergeStyles(posOut.style, base.style);

  const attrs = [
    `data-id="${shape.id}"`,
    classes ? `class="${classes}"` : '',
    style ? `style="${style}"` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return `<div ${attrs}>${safeContent}</div>`;
}
