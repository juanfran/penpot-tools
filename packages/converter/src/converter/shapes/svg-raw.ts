import type { SvgRawShape } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { mergeStyles } from '../utils/style';
import { resolvePositionOutput } from '../visual/position';
import { baseStyles } from '../visual/base';

function sanitizeSvg(content: string): string {
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '');
}

export function renderSvgRaw(shape: SvgRawShape, ctx: ConverterContext): string {
  const base = baseStyles(shape, ctx);
  const safeContent = sanitizeSvg(shape.content);
  const posStyle = resolvePositionOutput(shape, ctx);

  const style = mergeStyles(posStyle, base);

  const attrs = [
    `data-id="${shape.id}"`,
    `data-type="${shape.type}"`,
    style ? `style="${style}"` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return `<div ${attrs}>${safeContent}</div>`;
}
