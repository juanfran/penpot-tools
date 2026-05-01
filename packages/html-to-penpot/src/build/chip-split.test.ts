import { describe, expect, it } from 'vitest';
import type { MeasuredNode, PickedComputedStyle } from '../types';
import { hasChipVisuals, splitChipPatterns } from './chip-split';

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
    gridAutoFlow: 'row',
    fontFamily: 'Inter',
    fontSize: '12px',
    fontWeight: '600',
    fontStyle: 'normal',
    lineHeight: '16px',
    letterSpacing: 'normal',
    color: 'rgb(255, 255, 255)',
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

function leaf(opts: {
  index: number;
  rect: { x: number; y: number; width: number; height: number };
  text: string;
  cs?: Partial<PickedComputedStyle>;
  dataName?: string;
  offsetWidth?: number;
  offsetHeight?: number;
}): MeasuredNode {
  return {
    index: opts.index,
    parentIndex: null,
    childIndices: [],
    semanticTag: 'div',
    rect: opts.rect,
    offsetWidth: opts.offsetWidth ?? opts.rect.width,
    offsetHeight: opts.offsetHeight ?? opts.rect.height,
    computedStyle: style(opts.cs),
    dataAttrs: opts.dataName ? { 'data-name': opts.dataName } : {},
    inlineStyle: '',
    textContent: opts.text,
  };
}

describe('hasChipVisuals', () => {
  it('returns false for a plain text leaf', () => {
    expect(hasChipVisuals(style())).toBe(false);
  });

  it('detects a solid background-color', () => {
    expect(hasChipVisuals(style({ backgroundColor: 'rgb(26, 26, 26)' }))).toBe(true);
  });

  it('detects a gradient background-image', () => {
    expect(
      hasChipVisuals(
        style({ backgroundImage: 'linear-gradient(rgb(0, 0, 0), rgb(255, 255, 255))' }),
      ),
    ).toBe(true);
  });

  it('detects any non-zero border width', () => {
    expect(hasChipVisuals(style({ borderTopWidth: '1px' }))).toBe(true);
    expect(hasChipVisuals(style({ borderLeftWidth: '2px' }))).toBe(true);
  });

  it('detects a non-none box-shadow', () => {
    expect(hasChipVisuals(style({ boxShadow: 'rgb(0, 0, 0) 0px 2px 4px 0px' }))).toBe(true);
  });

  it('treats `transparent` and `rgba(0,0,0,0)` as no background', () => {
    expect(hasChipVisuals(style({ backgroundColor: 'transparent' }))).toBe(false);
    expect(hasChipVisuals(style({ backgroundColor: 'rgba(0, 0, 0, 0)' }))).toBe(false);
  });
});

describe('splitChipPatterns', () => {
  it('leaves plain text leaves untouched', () => {
    const nodes = [
      leaf({ index: 0, rect: { x: 0, y: 0, width: 100, height: 20 }, text: 'Plain' }),
    ];
    const out = splitChipPatterns(nodes);
    expect(out.length).toBe(1);
    expect(out[0]!.textContent).toBe('Plain');
    expect(out[0]!.childIndices).toEqual([]);
  });

  it('splits a chip with background-color into frame + inner text', () => {
    const chip = leaf({
      index: 0,
      rect: { x: 100, y: 50, width: 200, height: 40 },
      text: 'BROOKLYN',
      cs: {
        backgroundColor: 'rgb(243, 238, 229)',
        paddingTop: '10px',
        paddingRight: '18px',
        paddingBottom: '10px',
        paddingLeft: '18px',
        borderTopLeftRadius: '99px',
      },
      dataName: 'Location chip',
    });
    const out = splitChipPatterns([chip]);

    expect(out.length).toBe(2);
    const parent = out[0]!;
    const child = out[1]!;

    // Parent becomes a container (loses textContent, gains a child).
    expect(parent.textContent).toBeUndefined();
    expect(parent.childIndices).toEqual([1]);
    // Parent keeps its visual styling untouched.
    expect(parent.computedStyle.backgroundColor).toBe('rgb(243, 238, 229)');
    expect(parent.computedStyle.borderTopLeftRadius).toBe('99px');

    // Child is a leaf positioned at the inner content-box.
    expect(child.parentIndex).toBe(0);
    expect(child.textContent).toBe('BROOKLYN');
    expect(child.rect).toEqual({
      x: 118, // 100 + paddingLeft 18
      y: 60,  // 50 + paddingTop 10
      width: 164, // 200 - 18 - 18
      height: 20, // 40 - 10 - 10
    });
    // Child has every box visual cleared so it doesn't double-render.
    expect(child.computedStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(child.computedStyle.paddingLeft).toBe('0px');
    expect(child.computedStyle.borderTopLeftRadius).toBe('0px');
    // Typography is preserved.
    expect(child.computedStyle.fontFamily).toBe('Inter');
    expect(child.computedStyle.color).toBe('rgb(255, 255, 255)');
    // Child inherits the parent's data-name with a "text" suffix so the layer
    // tree stays readable in Penpot's outline.
    expect(child.dataAttrs['data-name']).toBe('Location chip text');
  });

  it('handles a rotated chip by positioning the child in the unrotated frame', () => {
    // A 100×30 chip rotated -5° has a slightly larger AABB; tree.ts will use
    // offsetWidth/offsetHeight + bbox-center to derive the unrotated rect.
    // The synthesized child must use the SAME unrotated coords so it lines up
    // inside the rotated frame.
    const chip = leaf({
      index: 0,
      rect: { x: 50, y: 50, width: 102, height: 32 }, // pretend rotated AABB
      offsetWidth: 100,
      offsetHeight: 30,
      text: 'EST. 1924',
      cs: {
        backgroundColor: 'rgb(200, 85, 61)',
        transform: 'matrix(0.996, -0.087, 0.087, 0.996, 0, 0)', // ~-5° rotation
        paddingTop: '6px',
        paddingRight: '12px',
        paddingBottom: '6px',
        paddingLeft: '12px',
      },
    });
    const out = splitChipPatterns([chip]);

    const child = out[1]!;
    // Unrotated parent spans (51, 51, 100, 30) — centered on the AABB centre
    // (101, 66). Inner content-box: (51+12, 51+6, 100-24, 30-12).
    expect(child.rect).toEqual({ x: 63, y: 57, width: 76, height: 18 });
    // Rotation belongs to the parent frame; the child clears it so the read-
    // mode converter doesn't double-rotate.
    expect(child.computedStyle.transform).toBe('none');
  });

  it('does NOT split a leaf that has only padding (no bg / border / shadow)', () => {
    // Padding alone has no visible effect without a background to fill.
    // Splitting would add a useless frame to the layer tree.
    const node = leaf({
      index: 0,
      rect: { x: 0, y: 0, width: 100, height: 40 },
      text: 'Just text',
      cs: {
        paddingTop: '10px',
        paddingLeft: '12px',
      },
    });
    const out = splitChipPatterns([node]);
    expect(out.length).toBe(1);
    expect(out[0]!.textContent).toBe('Just text');
  });

  it('inherits flex centring as text-align: center + verticalAlign: center', () => {
    // Icon-button pattern: a 44×44 div with bg + radius + flex centring + text.
    // The flex centring of an anonymous text run does not show up as
    // text-align:center in computed style (it stays at `start`). The synthesized
    // text child must be told explicitly that it should centre, otherwise the
    // glyph sits at the top-left of the circle.
    const chip = leaf({
      index: 0,
      rect: { x: 0, y: 0, width: 44, height: 44 },
      text: 'JF',
      cs: {
        backgroundColor: 'rgb(30, 33, 40)',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'start',
      },
    });
    const out = splitChipPatterns([chip]);

    const child = out[1]!;
    expect(child.computedStyle.textAlign).toBe('center');
    expect(child.textVerticalAlign).toBe('center');
  });

  it('respects flex-direction: column when mapping centring axes', () => {
    // With column direction, justify-content drives the vertical (main) axis
    // and align-items drives the horizontal (cross) axis. A column-flex chip
    // with `justify-content: flex-end; align-items: center` should land as
    // bottom-centre on the synthesized text.
    const chip = leaf({
      index: 0,
      rect: { x: 0, y: 0, width: 100, height: 60 },
      text: 'BOTTOM',
      cs: {
        backgroundColor: 'rgb(30, 33, 40)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        textAlign: 'start',
      },
    });
    const out = splitChipPatterns([chip]);

    const child = out[1]!;
    expect(child.computedStyle.textAlign).toBe('center');
    expect(child.textVerticalAlign).toBe('bottom');
  });

  it('does NOT override an explicit text-align on a non-flex chip', () => {
    // A plain pill with `text-align: right` should keep its right alignment.
    const chip = leaf({
      index: 0,
      rect: { x: 0, y: 0, width: 200, height: 30 },
      text: 'TRAILING',
      cs: {
        backgroundColor: 'rgb(243, 238, 229)',
        display: 'block',
        textAlign: 'right',
      },
    });
    const out = splitChipPatterns([chip]);

    const child = out[1]!;
    expect(child.computedStyle.textAlign).toBe('right');
    expect(child.textVerticalAlign).toBeUndefined();
  });

  it('does NOT split a container that already has element children', () => {
    // A frame with explicit children is not a chip leaf — leave the user's
    // layout intact even if the parent has a background.
    const parent: MeasuredNode = {
      ...leaf({ index: 0, rect: { x: 0, y: 0, width: 200, height: 100 }, text: '' }),
      childIndices: [1],
      textContent: undefined,
      computedStyle: style({ backgroundColor: 'rgb(255, 0, 0)' }),
    };
    const child = leaf({ index: 1, rect: { x: 10, y: 10, width: 50, height: 20 }, text: 'A' });
    child.parentIndex = 0;
    const out = splitChipPatterns([parent, child]);
    expect(out.length).toBe(2);
    expect(out[0]!.childIndices).toEqual([1]);
  });
});
