import { describe, expect, it } from 'vitest';
import type { PickedComputedStyle } from '../types';
import { splitBoxShadowList, strokesFromComputed } from './strokes';

function style(overrides: Partial<PickedComputedStyle>): PickedComputedStyle {
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
    textTransform: 'none',
    flexGrow: '0',
    flexShrink: '1',
    flexBasis: 'auto',
    width: 'auto',
    height: 'auto',
    ...overrides,
  };
}

describe('strokesFromComputed', () => {
  it('returns no strokes when there is no border or box-shadow', () => {
    const r = strokesFromComputed(style({}));
    expect(r.strokes).toEqual([]);
    expect(r.consumedShadowIndices.size).toBe(0);
  });

  it('emits an inner stroke for a uniform border', () => {
    const r = strokesFromComputed(
      style({
        borderTopWidth: '2px',
        borderRightWidth: '2px',
        borderBottomWidth: '2px',
        borderLeftWidth: '2px',
        borderTopColor: 'rgb(46, 81, 196)',
        borderTopStyle: 'solid',
      }),
    );
    expect(r.strokes).toEqual([
      {
        strokeColor: '#2E51C4',
        strokeOpacity: 1,
        strokeStyle: 'solid',
        strokeWidth: 2,
        strokeAlignment: 'inner',
      },
    ]);
  });

  it('skips non-uniform borders', () => {
    const r = strokesFromComputed(
      style({
        borderTopWidth: '2px',
        borderRightWidth: '0px',
        borderBottomWidth: '2px',
        borderLeftWidth: '0px',
      }),
    );
    expect(r.strokes).toEqual([]);
  });

  it('detects an outer stroke from the converter-style box-shadow', () => {
    const r = strokesFromComputed(
      style({ boxShadow: 'rgb(46, 81, 196) 0px 0px 0px 3px' }),
    );
    expect(r.strokes).toEqual([
      {
        strokeColor: '#2E51C4',
        strokeOpacity: 1,
        strokeStyle: 'solid',
        strokeWidth: 3,
        strokeAlignment: 'outer',
      },
    ]);
    expect(r.consumedShadowIndices.has(0)).toBe(true);
  });

  it('does NOT consume real shadows (with blur or offset)', () => {
    const r = strokesFromComputed(
      style({ boxShadow: 'rgba(0, 0, 0, 0.4) 0px 4px 12px 0px' }),
    );
    expect(r.strokes).toEqual([]);
    expect(r.consumedShadowIndices.size).toBe(0);
  });
});

describe('splitBoxShadowList', () => {
  it('splits comma-separated entries while respecting parens', () => {
    expect(
      splitBoxShadowList(
        'rgba(0, 0, 0, 0.4) 0px 4px 12px 0px, rgba(255, 255, 255, 0.1) 0px 0px 0px 1px',
      ),
    ).toEqual([
      'rgba(0, 0, 0, 0.4) 0px 4px 12px 0px',
      'rgba(255, 255, 255, 0.1) 0px 0px 0px 1px',
    ]);
  });

  it('returns empty for none / empty', () => {
    expect(splitBoxShadowList('')).toEqual([]);
    expect(splitBoxShadowList('none')).toEqual([]);
  });

  it('handles a single entry', () => {
    expect(splitBoxShadowList('rgb(0, 0, 0) 0px 0px 0px 2px')).toEqual([
      'rgb(0, 0, 0) 0px 0px 0px 2px',
    ]);
  });
});
