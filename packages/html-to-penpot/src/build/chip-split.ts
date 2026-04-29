import type { MeasuredNode, PickedComputedStyle } from '../types';
import { parseCssTransform } from './transform';

/**
 * "Chip pattern" detection + split.
 *
 * A common authoring shape is a single `<div>` carrying text PLUS a box
 * background / border / shadow / radius — pills, stamps, buttons:
 *
 *   <div style="padding:10px 18px; background:#1A1A1A; border-radius:99px;
 *               color:#FFF;">NEW</div>
 *
 * Penpot's data model gives that one element a single shape: `text`. But the
 * read-mode converter only renders text shapes' typography — it does NOT
 * paint their shape-level `fills` / `strokes` / `shadow`. The author's pill
 * background silently disappears on render.
 *
 * Rather than special-case text-shape rendering (which fights Penpot's
 * model), we expand the chip into the two-shape composition the model
 * actually expects: a `frame` carrying the box visuals + a child `text`
 * positioned at the inner content-box edge. Both shapes individually round-
 * trip through the read-mode converter without loss.
 */

export function splitChipPatterns(nodes: MeasuredNode[]): MeasuredNode[] {
  const out: MeasuredNode[] = nodes.map((n) => ({
    ...n,
    childIndices: [...n.childIndices],
  }));

  // Iterate by index (not by length) so we don't process synthesized children.
  const originalCount = out.length;
  for (let i = 0; i < originalCount; i++) {
    const parent = out[i]!;
    if (parent.textContent === undefined) continue;
    if (parent.childIndices.length > 0) continue;
    if (!hasChipVisuals(parent.computedStyle)) continue;

    const child = synthesizeTextChild(parent, out.length);
    out.push(child);
    parent.childIndices = [child.index];
    parent.textContent = undefined;
  }

  return out;
}

export function hasChipVisuals(cs: PickedComputedStyle): boolean {
  // Background-color (CSS reports transparent as `rgba(0, 0, 0, 0)`).
  const bg = cs.backgroundColor;
  if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return true;

  // Background-image (gradients, image URLs).
  if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;

  // Any non-zero border width on any side.
  const totalBorder =
    parsePxOr0(cs.borderTopWidth) +
    parsePxOr0(cs.borderRightWidth) +
    parsePxOr0(cs.borderBottomWidth) +
    parsePxOr0(cs.borderLeftWidth);
  if (totalBorder > 0) return true;

  // Box-shadow (excluding the literal `none`).
  if (cs.boxShadow && cs.boxShadow !== 'none') return true;

  return false;
}

function synthesizeTextChild(parent: MeasuredNode, childIndex: number): MeasuredNode {
  const cs = parent.computedStyle;
  const padTop = parsePxOr0(cs.paddingTop);
  const padRight = parsePxOr0(cs.paddingRight);
  const padBottom = parsePxOr0(cs.paddingBottom);
  const padLeft = parsePxOr0(cs.paddingLeft);

  // When the parent has a CSS rotation, `parent.rect` is the rotated bbox.
  // The synthesized text child must be positioned in the parent's UNROTATED
  // coordinate space — because the read-mode converter renders the parent
  // frame with `transform: rotate(...)`, which then visually rotates every
  // descendant. If we used the rotated bbox here the child would be rotated
  // twice (once by the parent's CSS transform, once by its own coords).
  const parsedTransform = parseCssTransform(cs.transform);
  const hasRotation = parsedTransform !== null && parsedTransform.rotationDeg !== 0;
  const unrotatedW = hasRotation ? parent.offsetWidth : parent.rect.width;
  const unrotatedH = hasRotation ? parent.offsetHeight : parent.rect.height;
  const unrotatedX = hasRotation
    ? parent.rect.x + parent.rect.width / 2 - unrotatedW / 2
    : parent.rect.x;
  const unrotatedY = hasRotation
    ? parent.rect.y + parent.rect.height / 2 - unrotatedH / 2
    : parent.rect.y;

  const innerW = Math.max(0, unrotatedW - padLeft - padRight);
  const innerH = Math.max(0, unrotatedH - padTop - padBottom);

  const innerRect = {
    x: unrotatedX + padLeft,
    y: unrotatedY + padTop,
    width: innerW,
    height: innerH,
  };

  // Inherit typography (font, color, line-height, letter-spacing, ...) but
  // strip every property that the parent frame is now responsible for.
  const childStyle: PickedComputedStyle = {
    ...cs,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    backgroundImage: 'none',
    borderTopWidth: '0px',
    borderRightWidth: '0px',
    borderBottomWidth: '0px',
    borderLeftWidth: '0px',
    borderTopLeftRadius: '0px',
    borderTopRightRadius: '0px',
    borderBottomRightRadius: '0px',
    borderBottomLeftRadius: '0px',
    boxShadow: 'none',
    paddingTop: '0px',
    paddingRight: '0px',
    paddingBottom: '0px',
    paddingLeft: '0px',
    transform: 'none',
  };

  const parentName = parent.dataAttrs['data-name'];
  const dataAttrs: Record<string, string> = parentName
    ? { 'data-name': `${parentName} text` }
    : {};

  return {
    index: childIndex,
    parentIndex: parent.index,
    childIndices: [],
    semanticTag: 'span',
    rect: innerRect,
    offsetWidth: innerW,
    offsetHeight: innerH,
    computedStyle: childStyle,
    dataAttrs,
    inlineStyle: '',
    textContent: parent.textContent,
  };
}

function parsePxOr0(value: string | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}
