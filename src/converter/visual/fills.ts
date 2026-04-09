import type { Fill, Gradient, GradientStop } from '../../penpot.types';
import type { ConverterContext } from '../types';
import { hexOpacityToCss } from '../utils/color';
import { tokenToCssVarName } from '../tokens';

/**
 * Converts a solid-color fill to a Tailwind arbitrary background-color class.
 * Returns `''` if no fill color is present.
 *
 * Examples:
 *  - `bg-[#ff0000]`
 *  - `bg-[rgba(255,_0,_0,_0.5)]`
 */
export function solidFillToClass(fill: Fill): string {
  if (!fill.fillColor) return '';

  const cssColor = hexOpacityToCss(fill.fillColor, fill.fillOpacity);
  // Tailwind arbitrary values require spaces to be represented with underscores
  const tailwindColor = cssColor.replace(/ /g, '_');
  return `bg-[${tailwindColor}]`;
}

function gradientStopToCss(stop: GradientStop): string {
  const color = hexOpacityToCss(stop.color, stop.opacity);
  const offset = Math.round(stop.offset * 100);
  return `${color} ${offset}%`;
}

/**
 * Converts a Penpot linear gradient to a CSS `background: linear-gradient(...)`
 * inline style string.
 *
 * The angle is computed from the start→end vector (relative 0–1 coordinates)
 * using `Math.atan2`, converting the screen-space vector to CSS clockwise-from-north
 * degrees (e.g. rightward → 90deg, downward → 180deg).
 */
export function linearGradientToStyle(gradient: Gradient): string {
  const dx = gradient.endX - gradient.startX;
  const dy = gradient.endY - gradient.startY;
  // CSS angle is clockwise from north; atan2(dx, -dy) maps screen-space vector to that convention
  const angleRad = Math.atan2(dx, -dy);
  const angleDeg = Math.round(angleRad * (180 / Math.PI));
  const normalizedAngle = ((angleDeg % 360) + 360) % 360;

  const stops = gradient.stops.map(gradientStopToCss).join(', ');
  return `background: linear-gradient(${normalizedAngle}deg, ${stops});`;
}

/**
 * Converts a Penpot radial gradient to a CSS `background: radial-gradient(...)`
 * inline style string.
 *
 * The center is encoded as `(startX, startY)` in relative 0–1 coordinates.
 * The radius is the Euclidean distance from `(startX, startY)` to `(endX, endY)`.
 * If start and end are the same point, defaults to a centered circle.
 */
export function radialGradientToStyle(gradient: Gradient): string {
  const dx = gradient.endX - gradient.startX;
  const dy = gradient.endY - gradient.startY;
  const radius = Math.sqrt(dx * dx + dy * dy);

  const centerX = Math.round(gradient.startX * 100);
  const centerY = Math.round(gradient.startY * 100);

  const stops = gradient.stops.map(gradientStopToCss).join(', ');

  if (radius === 0) {
    return `background: radial-gradient(circle at 50% 50%, ${stops});`;
  }

  return `background: radial-gradient(circle at ${centerX}% ${centerY}%, ${stops});`;
}

/**
 * Converts an image fill to CSS background-image inline style properties.
 * Returns `''` if no `fillImage` is present.
 *
 * Uses `background-size: contain` when `keepAspectRatio` is true,
 * otherwise defaults to `background-size: cover`.
 */
export function imageFillToStyle(fill: Fill, ctx: ConverterContext): string {
  if (!fill.fillImage) return '';

  const url = ctx.resolveImageUrl(fill.fillImage.id);
  // Escape single quotes in the URL to prevent breaking the CSS string
  const safeUrl = url.replace(/'/g, '%27');
  const size = fill.fillImage.keepAspectRatio ? 'contain' : 'cover';

  return (
    [
      `background-image: url('${safeUrl}')`,
      `background-size: ${size}`,
      `background-position: center`,
      `background-repeat: no-repeat`,
    ].join('; ') + ';'
  );
}

/**
 * Extracts the CSS image-layer value for a gradient (without the `background:` prefix).
 * Used when composing multi-layer backgrounds.
 */
function gradientToImageValue(gradient: Gradient): string {
  const stops = gradient.stops.map(gradientStopToCss).join(', ');
  if (gradient.type === 'linear') {
    const dx = gradient.endX - gradient.startX;
    const dy = gradient.endY - gradient.startY;
    const angleRad = Math.atan2(dx, -dy);
    const angleDeg = Math.round(angleRad * (180 / Math.PI));
    const normalizedAngle = ((angleDeg % 360) + 360) % 360;
    return `linear-gradient(${normalizedAngle}deg, ${stops})`;
  }
  const dx = gradient.endX - gradient.startX;
  const dy = gradient.endY - gradient.startY;
  const radius = Math.sqrt(dx * dx + dy * dy);
  const cx = Math.round(gradient.startX * 100);
  const cy = Math.round(gradient.startY * 100);
  return radius === 0
    ? `radial-gradient(circle at 50% 50%, ${stops})`
    : `radial-gradient(circle at ${cx}% ${cy}%, ${stops})`;
}

/** Converts a solid fill to a solid-color CSS image layer (for use in multi-layer backgrounds). */
function solidToImageValue(fill: Fill): string {
  const color = hexOpacityToCss(fill.fillColor!, fill.fillOpacity);
  return `linear-gradient(${color}, ${color})`;
}

interface BgLayer {
  image: string;
  size: string;
  position: string;
  repeat: string;
}

function fillToBgLayer(fill: Fill, ctx: ConverterContext): BgLayer | null {
  if (fill.fillColorGradient) {
    return {
      image: gradientToImageValue(fill.fillColorGradient),
      size: 'auto',
      position: '0% 0%',
      repeat: 'repeat',
    };
  }
  if (fill.fillImage) {
    const url = ctx.resolveImageUrl(fill.fillImage.id).replace(/'/g, '%27');
    return {
      image: `url('${url}')`,
      size: fill.fillImage.keepAspectRatio ? 'contain' : 'cover',
      position: 'center',
      repeat: 'no-repeat',
    };
  }
  if (fill.fillColor) {
    return {
      image: solidToImageValue(fill),
      size: 'auto',
      position: '0% 0%',
      repeat: 'repeat',
    };
  }
  return null;
}

/**
 * Dispatches each fill to the appropriate converter and accumulates
 * the result into `{ classes, style }`.
 *
 * - Single solid fill → Tailwind `bg-[color]` class
 * - All other cases (gradients, images, multiple fills) → CSS `background-*` inline styles
 *   using layered backgrounds (first fill = topmost CSS layer).
 */
export function fillsToOutput(
  fills: Fill[] | null | undefined,
  ctx: ConverterContext,
  fillTokenName?: string,
): { classes: string; style: string } {
  if (!fills || fills.length === 0) return { classes: '', style: '' };

  // Token override: emit CSS variable instead of raw color
  if (fillTokenName && ctx.tokens?.has(fillTokenName)) {
    return { classes: `bg-[var(--${tokenToCssVarName(fillTokenName)})]`, style: '' };
  }

  // Fast path: single fill
  if (fills.length === 1) {
    const fill = fills[0];
    if (fill.fillColorGradient) {
      const style =
        fill.fillColorGradient.type === 'linear'
          ? linearGradientToStyle(fill.fillColorGradient)
          : radialGradientToStyle(fill.fillColorGradient);
      return { classes: '', style };
    }
    if (fill.fillImage) {
      return { classes: '', style: imageFillToStyle(fill, ctx) };
    }
    if (fill.fillColor) {
      return { classes: solidFillToClass(fill), style: '' };
    }
    return { classes: '', style: '' };
  }

  // Multiple fills: build CSS layered background-image.
  // Penpot renders fills bottom-to-top (index 0 = bottom).
  // CSS background-image: the first value is on top — so reverse the array.
  const layers: BgLayer[] = [];
  for (const fill of [...fills].reverse()) {
    const layer = fillToBgLayer(fill, ctx);
    if (layer) layers.push(layer);
  }

  if (layers.length === 0) return { classes: '', style: '' };

  const parts = [
    `background-image: ${layers.map((l) => l.image).join(', ')}`,
    `background-size: ${layers.map((l) => l.size).join(', ')}`,
    `background-position: ${layers.map((l) => l.position).join(', ')}`,
    `background-repeat: ${layers.map((l) => l.repeat).join(', ')}`,
  ];
  return { classes: '', style: parts.join('; ') + ';' };
}
