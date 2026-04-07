import type { Shape } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { getChildren } from '../tree';
import { renderRect } from './rect';
import { renderCircle } from './circle';
import { renderImage } from './image';
import { renderPath } from './path';
import { renderBool } from './bool';
import { renderSvgRaw } from './svg-raw';
import { renderGroup } from './group';
import { renderFrame } from './frame';
import { renderText } from './text';

/**
 * Dispatches a shape to its type-specific renderer.
 * Unknown shape types fall back to an empty string.
 */
export function renderShape(
  shape: Shape,
  objects: Record<string, Shape>,
  ctx: ConverterContext,
): string {
  switch (shape.type) {
    case 'rect':
      return renderRect(shape, null, ctx);
    case 'circle':
      return renderCircle(shape, null, ctx);
    case 'image':
      return renderImage(shape, ctx);
    case 'path':
      return renderPath(shape, ctx);
    case 'bool':
      return renderBool(shape, ctx);
    case 'svg-raw':
      return renderSvgRaw(shape, ctx);
    case 'group': {
      const children = getChildren(shape, objects);
      return renderGroup(shape, children, objects, ctx);
    }
    case 'frame': {
      const children = getChildren(shape, objects);
      return renderFrame(shape, children, objects, ctx);
    }
    case 'text':
      return renderText(shape, ctx);
    default:
      return '';
  }
}
