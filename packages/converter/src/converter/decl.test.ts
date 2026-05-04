import { describe, expect, it } from 'vitest';
import { decl, SUPPORTED_PROPS } from './decl';

describe('decl — display / visibility', () => {
  it('emits display values verbatim', () => {
    expect(decl.display('flex')).toBe('display: flex;');
    expect(decl.display('grid')).toBe('display: grid;');
    expect(decl.display('none')).toBe('display: none;');
  });

  it('emits opacity as a unitless number', () => {
    expect(decl.opacity(0.5)).toBe('opacity: 0.5;');
    expect(decl.opacity(0)).toBe('opacity: 0;');
  });

  it('emits overflow keywords', () => {
    expect(decl.overflow('hidden')).toBe('overflow: hidden;');
  });
});

describe('decl — position & sizing', () => {
  it('formats numeric lengths via px() (drops zero decimals)', () => {
    expect(decl.left(10)).toBe('left: 10px;');
    expect(decl.top(0)).toBe('top: 0px;');
    expect(decl.width(100)).toBe('width: 100px;');
    expect(decl.height(50.5)).toBe('height: 50.5px;');
  });

  it('passes through CSS keyword lengths', () => {
    expect(decl.width('100%')).toBe('width: 100%;');
    expect(decl.height('auto')).toBe('height: auto;');
  });

  it('emits position keywords', () => {
    expect(decl.position('absolute')).toBe('position: absolute;');
    expect(decl.position('relative')).toBe('position: relative;');
  });

  it('emits z-index as integer', () => {
    expect(decl.zIndex(5)).toBe('z-index: 5;');
  });
});

describe('decl — spacing (Box4)', () => {
  it('emits a single value when given a number', () => {
    expect(decl.padding(8)).toBe('padding: 8px;');
    expect(decl.margin(0)).toBe('margin: 0px;');
  });

  it('emits four-tuple form when given a tuple', () => {
    expect(decl.padding([4, 8, 12, 16])).toBe('padding: 4px 8px 12px 16px;');
    expect(decl.margin([10, 20, 30, 40])).toBe('margin: 10px 20px 30px 40px;');
  });
});

describe('decl — flex container & item', () => {
  it('emits flex-direction', () => {
    expect(decl.flexDirection('row')).toBe('flex-direction: row;');
    expect(decl.flexDirection('column')).toBe('flex-direction: column;');
  });

  it('emits gaps in px', () => {
    expect(decl.gap(10)).toBe('gap: 10px;');
    expect(decl.rowGap(8)).toBe('row-gap: 8px;');
    expect(decl.columnGap(12)).toBe('column-gap: 12px;');
  });

  it('emits flex shorthand verbatim', () => {
    expect(decl.flex('1')).toBe('flex: 1;');
  });

  it('emits flex-shrink as integer', () => {
    expect(decl.flexShrink(0)).toBe('flex-shrink: 0;');
  });

  it('emits align-items / align-self / justify-content keywords', () => {
    expect(decl.alignItems('center')).toBe('align-items: center;');
    expect(decl.alignSelf('flex-end')).toBe('align-self: flex-end;');
    expect(decl.justifyContent('space-between')).toBe('justify-content: space-between;');
  });

  it('accepts grid-spec values for align-self (start / end)', () => {
    expect(decl.alignSelf('start')).toBe('align-self: start;');
    expect(decl.alignSelf('end')).toBe('align-self: end;');
  });
});

describe('decl — grid', () => {
  it('emits raw track values for grid-template-*', () => {
    expect(decl.gridTemplateColumns('1fr 2fr')).toBe('grid-template-columns: 1fr 2fr;');
    expect(decl.gridTemplateRows('auto 100px')).toBe('grid-template-rows: auto 100px;');
  });

  it('emits row/column starts as strings', () => {
    expect(decl.gridRowStart(2)).toBe('grid-row-start: 2;');
    expect(decl.gridColumnEnd('span 3')).toBe('grid-column-end: span 3;');
  });
});

describe('decl — visual', () => {
  it('emits raw colour / gradient strings for backgrounds', () => {
    expect(decl.background('linear-gradient(0deg, red, blue)')).toBe(
      'background: linear-gradient(0deg, red, blue);',
    );
    expect(decl.backgroundColor('#FF0033')).toBe('background-color: #FF0033;');
  });

  it('emits border-radius as a single value or four-tuple', () => {
    expect(decl.borderRadius(12)).toBe('border-radius: 12px;');
    expect(decl.borderRadius([12, 8, 12, 8])).toBe('border-radius: 12px 8px 12px 8px;');
  });

  it('emits box-shadow / filter / transform with raw values', () => {
    expect(decl.boxShadow('0 2px 8px rgba(0,0,0,0.1)')).toBe(
      'box-shadow: 0 2px 8px rgba(0,0,0,0.1);',
    );
    expect(decl.filter('blur(4px)')).toBe('filter: blur(4px);');
    expect(decl.transform('rotate(7deg)')).toBe('transform: rotate(7deg);');
  });

  it('emits mix-blend-mode keywords', () => {
    expect(decl.mixBlendMode('multiply')).toBe('mix-blend-mode: multiply;');
    expect(decl.mixBlendMode('luminosity')).toBe('mix-blend-mode: luminosity;');
  });
});

describe('decl — typography', () => {
  it('emits font-size in px', () => {
    expect(decl.fontSize(14)).toBe('font-size: 14px;');
  });

  it('emits font-weight verbatim (numeric or named)', () => {
    expect(decl.fontWeight(700)).toBe('font-weight: 700;');
    expect(decl.fontWeight('bold')).toBe('font-weight: bold;');
  });

  it('emits letter-spacing in px (number argument)', () => {
    expect(decl.letterSpacing(2)).toBe('letter-spacing: 2px;');
    expect(decl.letterSpacing(0.5)).toBe('letter-spacing: 0.5px;');
  });

  it('emits text properties as keywords', () => {
    expect(decl.textAlign('center')).toBe('text-align: center;');
    expect(decl.textTransform('uppercase')).toBe('text-transform: uppercase;');
    expect(decl.textDecoration('underline')).toBe('text-decoration: underline;');
    expect(decl.whiteSpace('nowrap')).toBe('white-space: nowrap;');
  });
});

describe('SUPPORTED_PROPS', () => {
  it('lists every key in decl exactly once', () => {
    expect(new Set(SUPPORTED_PROPS).size).toBe(SUPPORTED_PROPS.length);
    expect(new Set(SUPPORTED_PROPS)).toEqual(new Set(Object.keys(decl)));
  });

  it('contains the load-bearing properties consumers introspect', () => {
    for (const prop of [
      'display',
      'position',
      'width',
      'height',
      'padding',
      'margin',
      'gap',
      'background',
      'color',
      'borderRadius',
      'boxShadow',
      'fontFamily',
      'fontSize',
      'transform',
    ] as const) {
      expect(SUPPORTED_PROPS).toContain(prop);
    }
  });
});
