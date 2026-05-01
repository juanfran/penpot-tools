import { describe, expect, it } from 'vitest';
import { buildTextContent } from './text-content';
import type { PickedComputedStyle } from '../types';

function makeStyle(over: Partial<PickedComputedStyle> = {}): PickedComputedStyle {
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
    borderTopStyle: 'none',
    borderTopLeftRadius: '0px',
    borderTopRightRadius: '0px',
    borderBottomRightRadius: '0px',
    borderBottomLeftRadius: '0px',
    boxShadow: 'none',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
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
    gridAutoFlow: 'row',
    fontFamily: 'Inter',
    fontSize: '16px',
    fontWeight: '400',
    fontStyle: 'normal',
    lineHeight: '24px',
    letterSpacing: 'normal',
    color: 'rgb(0, 0, 0)',
    textAlign: 'left',
    textTransform: 'none',
    flexGrow: '0',
    flexShrink: '1',
    flexBasis: 'auto',
    width: '100px',
    height: '20px',
    ...over,
  };
}

function leafOf(style: PickedComputedStyle) {
  const content = buildTextContent('hi', style);
  return content.children[0]!.children[0]!.children[0];
}

describe('buildTextContent verticalAlign', () => {
  it('defaults the root vertical-align to top', () => {
    const content = buildTextContent('hi', makeStyle());
    expect(content.verticalAlign).toBe('top');
  });

  it('honours an explicit verticalAlign override (chip-split centring)', () => {
    const content = buildTextContent('hi', makeStyle(), { verticalAlign: 'center' });
    expect(content.verticalAlign).toBe('center');
  });

  it('passes through `bottom` for align-items: flex-end chips', () => {
    const content = buildTextContent('hi', makeStyle(), { verticalAlign: 'bottom' });
    expect(content.verticalAlign).toBe('bottom');
  });
});

describe('buildTextContent lineHeight', () => {
  it('defaults to 1.2 when the author did not declare line-height', () => {
    // Computed style still shows the inherited preflight value (1.5×16=24px)
    // but the inline style attr has nothing about line-height.
    const content = buildTextContent('hi', makeStyle({ lineHeight: '24px' }), {});
    const leaf = content.children[0]!.children[0]!.children[0];
    expect(leaf?.lineHeight).toBe('1.2');
  });

  it('honours an explicit inline line-height', () => {
    const content = buildTextContent('hi', makeStyle({ lineHeight: '20px' }), {
      inlineStyle: 'font-size: 16px; line-height: 20px;',
    });
    const leaf = content.children[0]!.children[0]!.children[0];
    expect(leaf?.lineHeight).toBe('20px');
  });

  it('honours an explicit unitless inline line-height', () => {
    const content = buildTextContent('hi', makeStyle({ lineHeight: '22.4px' }), {
      inlineStyle: 'line-height: 1.4;',
    });
    const leaf = content.children[0]!.children[0]!.children[0];
    // Browser normalises unitless to px in computedStyle, we trust that.
    expect(leaf?.lineHeight).toBe('22.4px');
  });

  it('uses 1.2 fallback when computed is "normal" (no preflight cascade)', () => {
    const content = buildTextContent('hi', makeStyle({ lineHeight: 'normal' }), {
      inlineStyle: 'line-height: normal;',
    });
    const leaf = content.children[0]!.children[0]!.children[0];
    expect(leaf?.lineHeight).toBe('1.2');
  });
});

describe('buildTextContent letterSpacing', () => {
  it('strips px from computed letter-spacing — Penpot stores it unitless', () => {
    const leaf = leafOf(makeStyle({ letterSpacing: '-6px' }));
    expect(leaf?.letterSpacing).toBe('-6');
  });

  it('handles fractional values', () => {
    const leaf = leafOf(makeStyle({ letterSpacing: '2.5px' }));
    expect(leaf?.letterSpacing).toBe('2.5');
  });

  it('maps "normal" to "0"', () => {
    const leaf = leafOf(makeStyle({ letterSpacing: 'normal' }));
    expect(leaf?.letterSpacing).toBe('0');
  });

  it('passes already-unitless values through', () => {
    const leaf = leafOf(makeStyle({ letterSpacing: '0' }));
    expect(leaf?.letterSpacing).toBe('0');
  });
});
