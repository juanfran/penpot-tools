import type { Shape } from '../penpot.types';
import type { ConverterContext } from './types';
import { renderShape as dispatchShape } from './shapes/dispatch';

/**
 * Injects additional HTML attributes into the first opening tag of an HTML string.
 * e.g. `<div class="foo">` → `<div class="foo" data-x="y">`
 */
function injectAttrs(html: string, attrs: Record<string, string>): string {
  const entries = Object.entries(attrs);
  if (entries.length === 0) return html;
  const attrStr = entries.map(([k, v]) => `${k}="${v}"`).join(' ');
  return html.replace(/^(<\w[\w-]*)/, `$1 ${attrStr}`);
}

/**
 * The main recursive entry point for converting a Penpot shape to HTML.
 *
 * Dispatches to the appropriate type-specific renderer based on `shape.type`.
 * The `parent` parameter is available for constraint-based positioning logic
 * (e.g. left/right/top/bottom constraints relative to the parent frame).
 *
 * Adds metadata data attributes to every rendered element:
 * - `data-penpot-name`: the shape's name (escaped)
 * - `data-penpot-locked="true"`: when shape is locked (editor-only flag)
 * - `data-penpot-blocked="true"`: when shape is blocked (editor-only flag)
 *
 * Component instances (shapes with `componentId`) are rendered identically to
 * their underlying type — live component sync is not supported; instances are
 * treated as static HTML.
 *
 * Unknown shape types return an empty string.
 */
export function renderShape(
  shape: Shape,
  objects: Record<string, Shape>,
  ctx: ConverterContext,
): string {
  const html = dispatchShape(shape, objects, ctx);
  if (!html) return html;

  const attrs: Record<string, string> = {};

  // locked and blocked are editor-only flags not in the base types;
  // handle them defensively via type widening
  const extended = shape as Shape & { locked?: boolean; blocked?: boolean };
  if (extended.locked) attrs['data-penpot-locked'] = 'true';
  if (extended.blocked) attrs['data-penpot-blocked'] = 'true';

  return injectAttrs(html, attrs);
}
