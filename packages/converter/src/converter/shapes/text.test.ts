import { describe, it, expect } from 'vitest';
import { textLeafToStyles, textLeafColorStyle, renderParagraph, renderText } from './text';
import { renderFrame } from './frame';
import type {
  TextLeaf,
  ParagraphNode,
  TextShape,
  FrameShape,
  Shape,
  Typography,
  Uuid,
  HexColor,
} from '../../penpot.types';
import type { ConverterContext } from '../types';

const ctx: ConverterContext = {
  resolveImageUrl: (id) => `https://assets.example.com/${id}`,
};

const makeLeaf = (overrides: Partial<TextLeaf> = {}): TextLeaf => ({
  text: 'Hello',
  ...overrides,
});

describe('textLeafToStyles', () => {
  it('returns empty string for a bare leaf', () => {
    expect(textLeafToStyles(makeLeaf())).toBe('');
  });

  it('maps fontSize to font-size style', () => {
    expect(textLeafToStyles(makeLeaf({ fontSize: '16' }))).toContain('font-size: 16px;');
  });

  it('maps fontWeight to font-weight style', () => {
    expect(textLeafToStyles(makeLeaf({ fontWeight: '700' }))).toContain('font-weight: 700;');
  });

  it('maps fontStyle italic to font-style: italic', () => {
    expect(textLeafToStyles(makeLeaf({ fontStyle: 'italic' }))).toContain('font-style: italic;');
  });

  it('maps textDecoration underline to text-decoration: underline', () => {
    expect(textLeafToStyles(makeLeaf({ textDecoration: 'underline' }))).toContain(
      'text-decoration: underline;',
    );
  });

  it('maps textDecoration line-through to text-decoration: line-through', () => {
    expect(textLeafToStyles(makeLeaf({ textDecoration: 'line-through' }))).toContain(
      'text-decoration: line-through;',
    );
  });

  it('maps textTransform uppercase to text-transform: uppercase', () => {
    expect(textLeafToStyles(makeLeaf({ textTransform: 'uppercase' }))).toContain(
      'text-transform: uppercase;',
    );
  });

  it('maps textTransform lowercase to text-transform: lowercase', () => {
    expect(textLeafToStyles(makeLeaf({ textTransform: 'lowercase' }))).toContain(
      'text-transform: lowercase;',
    );
  });

  it('maps textTransform capitalize to text-transform: capitalize', () => {
    expect(textLeafToStyles(makeLeaf({ textTransform: 'capitalize' }))).toContain(
      'text-transform: capitalize;',
    );
  });

  it('maps letterSpacing to letter-spacing style', () => {
    expect(textLeafToStyles(makeLeaf({ letterSpacing: '2' }))).toContain('letter-spacing: 2px;');
  });

  it('maps lineHeight to line-height style', () => {
    expect(textLeafToStyles(makeLeaf({ lineHeight: '1.5' }))).toContain('line-height: 1.5;');
  });

  it('maps fontFamily to font-family style', () => {
    expect(textLeafToStyles(makeLeaf({ fontFamily: 'Inter' }))).toContain("font-family: 'Inter';");
  });
});

describe('textLeafToStyles with typography resolution', () => {
  const makeTypography = (overrides: Partial<Typography> = {}): Typography => ({
    id: 'typo-1' as Uuid,
    name: 'Heading',
    fontId: 'inter',
    fontFamily: 'Inter',
    fontVariantId: 'regular',
    fontSize: '24',
    fontWeight: '700',
    fontStyle: 'normal',
    lineHeight: '1.2',
    letterSpacing: '0',
    textTransform: 'none',
    ...overrides,
  });

  it('uses typography defaults when leaf has no inline values', () => {
    const typos: Record<string, Typography> = { 'typo-1': makeTypography() };
    const result = textLeafToStyles(makeLeaf({ typographyRefId: 'typo-1' as Uuid }), typos);
    expect(result).toContain('font-size: 24px;');
    expect(result).toContain('font-weight: 700;');
    expect(result).toContain("font-family: 'Inter';");
  });

  it('leaf inline values override typography defaults', () => {
    const typos: Record<string, Typography> = { 'typo-1': makeTypography({ fontSize: '24' }) };
    const result = textLeafToStyles(
      makeLeaf({ typographyRefId: 'typo-1' as Uuid, fontSize: '32' }),
      typos,
    );
    expect(result).toContain('font-size: 32px;');
    expect(result).not.toContain('font-size: 24px;');
  });

  it('ignores missing typography ref gracefully', () => {
    const result = textLeafToStyles(
      makeLeaf({ typographyRefId: 'missing' as Uuid, fontSize: '16' }),
      {},
    );
    expect(result).toContain('font-size: 16px;');
  });
});

describe('textLeafColorStyle', () => {
  it('returns empty string when no fills', () => {
    expect(textLeafColorStyle(makeLeaf())).toBe('');
  });

  it('returns color style for solid fill', () => {
    const result = textLeafColorStyle(makeLeaf({ fills: [{ fillColor: '#ff0000' as HexColor }] }));
    expect(result).toContain('color: #ff0000;');
  });

  it('returns color with rgba for solid fill with opacity', () => {
    const result = textLeafColorStyle(
      makeLeaf({ fills: [{ fillColor: '#ff0000' as HexColor, fillOpacity: 0.5 }] }),
    );
    expect(result).toContain('color: rgba(');
  });

  it('uses fallbackColor when leaf has no fills', () => {
    expect(textLeafColorStyle(makeLeaf(), undefined, undefined, '#f54554')).toBe(
      'color: #f54554;',
    );
  });

  it('prefers leaf fill over fallbackColor when both are set', () => {
    const result = textLeafColorStyle(
      makeLeaf({ fills: [{ fillColor: '#00ff00' as HexColor }] }),
      undefined,
      undefined,
      '#f54554',
    );
    expect(result).toBe('color: #00ff00;');
  });
});

const makeParagraph = (overrides: Partial<ParagraphNode> = {}): ParagraphNode => ({
  type: 'paragraph',
  children: [makeLeaf()],
  ...overrides,
});

describe('renderParagraph', () => {
  it('renders a p element', () => {
    const html = renderParagraph(makeParagraph());
    expect(html).toMatch(/^<p/);
    expect(html).toMatch(/<\/p>$/);
  });

  it('includes leaf text content', () => {
    const html = renderParagraph(makeParagraph({ children: [makeLeaf({ text: 'World' })] }));
    expect(html).toContain('World');
  });

  it('wraps leaves with differing styles in spans', () => {
    const html = renderParagraph(
      makeParagraph({
        children: [
          makeLeaf({ text: 'A', fontWeight: '700' }),
          makeLeaf({ text: 'B', fontWeight: '400' }),
        ],
      }),
    );
    expect(html).toContain('<span');
  });

  it('applies paragraph-level font size as style', () => {
    const html = renderParagraph(makeParagraph({ fontSize: '20' }));
    expect(html).toContain('font-size: 20px;');
  });

  it('has no class attribute', () => {
    const html = renderParagraph(makeParagraph());
    expect(html).not.toContain('class=');
  });
});

const makeTextShape = (overrides: Partial<TextShape> = {}): TextShape => ({
  id: 'text-1' as Uuid,
  name: 'Text',
  type: 'text',
  x: 10,
  y: 20,
  width: 200,
  height: 50,
  selrect: { x: 10, y: 20, width: 200, height: 50 },
  points: [],
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  parentId: 'frame-1' as Uuid,
  frameId: 'frame-1' as Uuid,
  content: {
    type: 'root',
    children: [
      {
        type: 'paragraph-set',
        children: [{ type: 'paragraph', children: [{ text: 'Hello world' }] }],
      },
    ],
  },
  ...overrides,
});

describe('renderText', () => {
  it('renders a div with data-id', () => {
    expect(renderText(makeTextShape(), ctx)).toContain('data-id="text-1"');
  });

  it('includes data-type attribute', () => {
    expect(renderText(makeTextShape(), ctx)).toContain('data-type="text"');
  });

  it('renders text content', () => {
    expect(renderText(makeTextShape(), ctx)).toContain('Hello world');
  });

  it('renders empty div when content is null', () => {
    const html = renderText(makeTextShape({ content: null }), ctx);
    expect(html).toContain('data-id="text-1"');
    expect(html).not.toContain('Hello');
  });

  it('applies absolute positioning in style', () => {
    const html = renderText(makeTextShape(), ctx);
    expect(html).toContain('position: absolute;');
    expect(html).toContain('left: 10px;');
    expect(html).toContain('top: 20px;');
  });

  it('applies width and height in style', () => {
    const html = renderText(makeTextShape(), ctx);
    expect(html).toContain('width: 200px;');
    expect(html).toContain('height: 50px;');
  });

  it('adds white-space: nowrap for growType auto-width', () => {
    expect(renderText(makeTextShape({ growType: 'auto-width' }), ctx)).toContain(
      'white-space: nowrap;',
    );
  });

  it('does not add white-space: nowrap for growType auto-height', () => {
    expect(renderText(makeTextShape({ growType: 'auto-height' }), ctx)).not.toContain(
      'white-space: nowrap;',
    );
  });

  it('does not add white-space: nowrap when growType is absent', () => {
    expect(renderText(makeTextShape(), ctx)).not.toContain('white-space: nowrap;');
  });

  it('adds white-space: nowrap for auto-width inside flex layout', () => {
    expect(
      renderText(makeTextShape({ growType: 'auto-width' }), { ...ctx, _parentIsLayout: true }),
    ).toContain('white-space: nowrap;');
  });

  it('uses width: 100% inside flex layout (fill-width text does not overflow)', () => {
    const html = renderText(makeTextShape(), { ...ctx, _parentIsLayout: true });
    expect(html).toContain('width: 100%');
    expect(html).not.toContain('width: 200px');
  });

  it('uses height: 100% inside flex layout', () => {
    const html = renderText(makeTextShape(), { ...ctx, _parentIsLayout: true });
    expect(html).toContain('height: 100%');
    expect(html).not.toContain('height: 50px');
  });

  it('uses explicit px width inside flex layout when auto-width sizing', () => {
    const html = renderText(makeTextShape(), {
      ...ctx,
      _parentIsLayout: true,
      _parentIsLayoutAutoW: true,
    });
    expect(html).toContain('width: 200px');
    expect(html).not.toContain('width: 100%');
  });

  it('has no class attribute', () => {
    expect(renderText(makeTextShape(), ctx)).not.toContain('class=');
  });

  it('applies flex column + justify-content center for content.verticalAlign center', () => {
    const html = renderText(
      makeTextShape({
        content: {
          type: 'root',
          verticalAlign: 'center',
          children: [
            {
              type: 'paragraph-set',
              children: [{ type: 'paragraph', children: [{ text: 'Hello world' }] }],
            },
          ],
        },
      }),
      ctx,
    );
    expect(html).toContain('display: flex;');
    expect(html).toContain('flex-direction: column;');
    expect(html).toContain('justify-content: center;');
  });

  it('applies flex column + justify-content flex-end for content.verticalAlign bottom', () => {
    const html = renderText(
      makeTextShape({
        content: {
          type: 'root',
          verticalAlign: 'bottom',
          children: [
            {
              type: 'paragraph-set',
              children: [{ type: 'paragraph', children: [{ text: 'Hello world' }] }],
            },
          ],
        },
      }),
      ctx,
    );
    expect(html).toContain('display: flex;');
    expect(html).toContain('flex-direction: column;');
    expect(html).toContain('justify-content: flex-end;');
  });

  it('does not apply flex styles for content.verticalAlign top', () => {
    const html = renderText(
      makeTextShape({
        content: {
          type: 'root',
          verticalAlign: 'top',
          children: [
            {
              type: 'paragraph-set',
              children: [{ type: 'paragraph', children: [{ text: 'Hello world' }] }],
            },
          ],
        },
      }),
      ctx,
    );
    expect(html).not.toContain('justify-content:');
  });

  it('does not apply flex styles when verticalAlign is absent', () => {
    const html = renderText(makeTextShape(), ctx);
    expect(html).not.toContain('justify-content:');
  });
});

describe('renderFrame with flex row and fill-width text child', () => {
  const makeId = (n: number) => `00000000-0000-0000-0000-00000000000${n}` as Uuid;

  const iconFrame: FrameShape = {
    id: makeId(2),
    name: 'Icon',
    type: 'frame',
    x: 10,
    y: 10,
    width: 20,
    height: 20,
    selrect: { x: 10, y: 10, width: 20, height: 20 },
    points: [],
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    parentId: makeId(1),
    frameId: makeId(1),
    shapes: [],
    fills: [],
    strokes: [],
  };

  const fillTextShape: TextShape = {
    id: makeId(3),
    name: 'Label',
    type: 'text',
    x: 38,
    y: 13,
    width: 200,
    height: 14,
    selrect: { x: 38, y: 13, width: 200, height: 14 },
    points: [],
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    parentId: makeId(1),
    frameId: makeId(1),
    layoutItemHSizing: 'fill',
    layoutItemVSizing: 'fix',
    content: {
      type: 'root',
      children: [
        {
          type: 'paragraph-set',
          children: [{ type: 'paragraph', children: [{ text: 'Sample label' }] }],
        },
      ],
    },
  };

  const flexParent: FrameShape = {
    id: makeId(1),
    name: 'Row',
    type: 'frame',
    x: 0,
    y: 0,
    width: 300,
    height: 40,
    selrect: { x: 0, y: 0, width: 300, height: 40 },
    points: [],
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    parentId: makeId(1),
    frameId: makeId(1),
    layout: 'flex' as unknown as undefined,
    layoutFlexDir: 'row',
    layoutAlignItems: 'center',
    layoutGap: { rowGap: 8, columnGap: 8 } as unknown as undefined,
    shapes: [makeId(2), makeId(3)],
    fills: [],
    strokes: [],
  };

  const objects: Record<string, Shape> = {
    [makeId(1)]: flexParent,
    [makeId(2)]: iconFrame,
    [makeId(3)]: fillTextShape,
  };

  it('fill-width text child renders width: 100% not hardcoded px', () => {
    const html = renderFrame(flexParent, [iconFrame, fillTextShape], objects, ctx);
    const textIdx = html.indexOf(`data-id="${makeId(3)}"`);
    const styleStart = html.indexOf('style=', textIdx);
    const styleSnippet = html.slice(styleStart, styleStart + 60);
    expect(styleSnippet).toContain('width: 100%');
    expect(html).not.toContain('width: 200px');
  });

  it('fill-width text wrapper gets flex: 1', () => {
    const html = renderFrame(flexParent, [iconFrame, fillTextShape], objects, ctx);
    expect(html).toContain('flex: 1');
  });

  it('absolute-positioned fill-sized text child keeps explicit px (wrapper has no flex sizing)', () => {
    const absText: TextShape = {
      ...fillTextShape,
      id: makeId(4),
      width: 58,
      height: 58,
      layoutItemHSizing: 'fill',
      layoutItemVSizing: 'fill',
      layoutItemAbsolute: true,
    } as TextShape;
    const parent = { ...flexParent, shapes: [makeId(4)] };
    const objs: Record<string, Shape> = { [makeId(1)]: parent, [makeId(4)]: absText };
    const html = renderFrame(parent, [absText], objs, ctx);
    const textIdx = html.indexOf(`data-id="${makeId(4)}"`);
    const styleStart = html.indexOf('style=', textIdx);
    const styleSnippet = html.slice(styleStart, styleStart + 80);
    expect(styleSnippet).toContain('width: 58px');
    expect(styleSnippet).toContain('height: 58px');
  });
});
