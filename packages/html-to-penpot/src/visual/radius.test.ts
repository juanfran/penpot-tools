import { describe, expect, it } from 'vitest';
import type { PickedComputedStyle } from '../types';
import { radiusFromComputed } from './radius';

function style(overrides: Partial<PickedComputedStyle> = {}): PickedComputedStyle {
  return {
    display: 'block',
    position: 'static',
    transform: 'none',
    opacity: '1',
    mixBlendMode: 'normal',
    filter: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0)',
    backgroundImage: 'none',
    borderTopWidth: '0px',
    borderRightWidth: '0px',
    borderBottomWidth: '0px',
    borderLeftWidth: '0px',
    borderTopColor: 'rgb(0, 0, 0)',
    borderTopStyle: 'solid',
    borderTopLeftRadius: '0px',
    borderTopRightRadius: '0px',
    borderBottomRightRadius: '0px',
    borderBottomLeftRadius: '0px',
    boxShadow: 'none',
    flexDirection: 'row',
    justifyContent: 'normal',
    alignItems: 'normal',
    rowGap: '0px',
    columnGap: '0px',
    paddingTop: '0px',
    paddingRight: '0px',
    paddingBottom: '0px',
    paddingLeft: '0px',
    gridTemplateColumns: 'none',
    gridTemplateRows: 'none',
    gridRowStart: 'auto',
    gridColumnStart: 'auto',
    fontFamily: 'sans-serif',
    fontSize: '14px',
    fontWeight: '400',
    fontStyle: 'normal',
    lineHeight: 'normal',
    letterSpacing: 'normal',
    color: 'rgb(0, 0, 0)',
    textAlign: 'left',
    flexGrow: '0',
    flexShrink: '1',
    flexBasis: 'auto',
    width: 'auto',
    height: 'auto',
    ...overrides,
  };
}

describe('radiusFromComputed', () => {
  it('returns empty object when all corners are 0', () => {
    expect(radiusFromComputed(style(), { width: 100, height: 50 })).toEqual({});
  });

  it('parses uniform px radius', () => {
    const out = radiusFromComputed(
      style({
        borderTopLeftRadius: '12px',
        borderTopRightRadius: '12px',
        borderBottomRightRadius: '12px',
        borderBottomLeftRadius: '12px',
      }),
      { width: 200, height: 100 },
    );
    expect(out).toEqual({ r1: 12, r2: 12, r3: 12, r4: 12 });
  });

  it('parses per-corner px radii', () => {
    const out = radiusFromComputed(
      style({
        borderTopLeftRadius: '4px',
        borderTopRightRadius: '8px',
        borderBottomRightRadius: '12px',
        borderBottomLeftRadius: '16px',
      }),
      { width: 200, height: 100 },
    );
    expect(out).toEqual({ r1: 4, r2: 8, r3: 12, r4: 16 });
  });

  it('resolves border-radius:50% on a square element to a circle', () => {
    // Real-world bug: a 46×46 save badge with border-radius:50% rendered as a
    // square because Chromium returns "50%" verbatim from getComputedStyle.
    const out = radiusFromComputed(
      style({
        borderTopLeftRadius: '50%',
        borderTopRightRadius: '50%',
        borderBottomRightRadius: '50%',
        borderBottomLeftRadius: '50%',
      }),
      { width: 46, height: 46 },
    );
    expect(out).toEqual({ r1: 23, r2: 23, r3: 23, r4: 23 });
  });

  it('resolves percentage radius against min(width, height) for non-square boxes', () => {
    // Penpot stores a single scalar per corner — clamping to the smaller side
    // keeps the corner from exceeding either half-cap. A 100×40 element with
    // 50% gets r=20 (a stadium-shape on the short axis).
    const out = radiusFromComputed(
      style({
        borderTopLeftRadius: '50%',
        borderTopRightRadius: '50%',
        borderBottomRightRadius: '50%',
        borderBottomLeftRadius: '50%',
      }),
      { width: 100, height: 40 },
    );
    expect(out).toEqual({ r1: 20, r2: 20, r3: 20, r4: 20 });
  });

  it('handles a mix of px and % across corners', () => {
    const out = radiusFromComputed(
      style({
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '50%',
        borderBottomRightRadius: '0px',
        borderBottomLeftRadius: '25%',
      }),
      { width: 80, height: 40 },
    );
    expect(out).toEqual({ r1: 8, r2: 20, r3: 0, r4: 10 });
  });

  it('still returns empty when zero-area element has 0 radii', () => {
    // Edge case: a 0×0 measured element shouldn't blow up — base is 0, % is 0.
    const out = radiusFromComputed(
      style({ borderTopLeftRadius: '50%' }),
      { width: 0, height: 0 },
    );
    // 0 * 0.5 = 0 in the only non-zero corner; rest already 0; whole object empty.
    expect(out).toEqual({});
  });
});
