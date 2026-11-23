export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface CardPlacementInput {
  /** The comment point on screen (the pin's bottom-left corner). */
  origin: { x: number; y: number };
  /** Pin size in screen px (the pin occupies [0, pin] × [-pin, 0] from the origin). */
  pin: number;
  card: { width: number; height: number };
  /** Visible canvas area on screen. */
  bounds: Rect;
  /** Space kept between the card and the pin / canvas edges. */
  gap: number;
}

/**
 * Where to put a thread card, relative to the comment point, so it stays
 * inside the visible canvas: to the right of the pin when it fits, else to
 * its left, else clamped against the right edge; top-aligned with the pin,
 * shifted up or down to stay on screen (top edge wins when the card is taller
 * than the canvas).
 */
export function placeCard({ origin, pin, card, bounds, gap }: CardPlacementInput): {
  left: number;
  top: number;
} {
  const right = pin + gap;
  const leftSide = -(card.width + gap);
  let left: number;
  if (origin.x + right + card.width <= bounds.right - gap) left = right;
  else if (origin.x + leftSide >= bounds.left + gap) left = leftSide;
  else left = Math.max(bounds.left + gap, bounds.right - gap - card.width) - origin.x;

  const minTop = bounds.top + gap - origin.y;
  const maxTop = bounds.bottom - gap - card.height - origin.y;
  const top = Math.max(minTop, Math.min(-pin, maxTop));
  return { left, top };
}
