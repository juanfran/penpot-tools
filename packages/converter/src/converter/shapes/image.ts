import type { ImageShape } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { tag } from '../utils/html';
import { cls } from '../utils/tailwind';
import { mergeStyles } from '../utils/style';
import { resolvePositionOutput } from '../visual/position';
import { baseClasses } from '../visual/base';

/**
 * Renders a Penpot `ImageShape` as an `<img>` element.
 *
 * - `src` is resolved via `ctx.resolveImageUrl(shape.metadata.id)`.
 * - `alt=""` marks the image as decorative.
 * - `width` and `height` come from the shape bounding box.
 * - `data-id` carries the Penpot shape ID.
 * - Fills on an image shape are ignored (they blend over the image — skip for simplicity).
 */
export function renderImage(shape: ImageShape, ctx: ConverterContext): string {
  const base = baseClasses(shape, ctx);
  const src = ctx.resolveImageUrl(shape.metadata.id);
  const posOut = resolvePositionOutput(shape, ctx);

  const classes = cls(posOut.classes, base.classes);
  const style = mergeStyles(posOut.style, base.style);

  return tag('img', {
    'data-id': shape.id,
    src,
    width: String(shape.width),
    height: String(shape.height),
    alt: '',
    class: classes || undefined,
    style: style || undefined,
  });
}
