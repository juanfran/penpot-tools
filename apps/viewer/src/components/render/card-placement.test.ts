import { describe, expect, it } from 'vitest';
import { placeCard } from './card-placement';

const bounds = { left: 0, top: 0, right: 1000, bottom: 800 };
const base = { pin: 28, card: { width: 320, height: 300 }, bounds, gap: 8 };

describe('placeCard', () => {
  it('sits to the right of the pin, top-aligned, when it fits', () => {
    expect(placeCard({ ...base, origin: { x: 100, y: 200 } })).toEqual({ left: 36, top: -28 });
  });

  it('flips to the left near the right edge', () => {
    expect(placeCard({ ...base, origin: { x: 900, y: 200 } })).toEqual({ left: -328, top: -28 });
  });

  it('clamps against the right edge when neither side fits', () => {
    const narrow = { ...bounds, right: 400 };
    // Card ends at the right edge minus the gap: 400 - 8 - 320 = 72 → 72 - 200.
    expect(placeCard({ ...base, bounds: narrow, origin: { x: 200, y: 200 } }).left).toBe(-128);
  });

  it('moves up near the bottom and down near the top', () => {
    expect(placeCard({ ...base, origin: { x: 100, y: 780 } }).top).toBe(800 - 8 - 300 - 780);
    expect(placeCard({ ...base, origin: { x: 100, y: 10 } }).top).toBe(8 - 10);
  });

  it('keeps the top edge visible when the card is taller than the canvas', () => {
    const short = { ...bounds, bottom: 200 };
    expect(placeCard({ ...base, bounds: short, origin: { x: 100, y: 100 } }).top).toBe(8 - 100);
  });
});
