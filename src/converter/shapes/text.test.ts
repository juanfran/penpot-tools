import { describe, it, expect } from 'vitest';
import {
  textLeafToClasses,
  textLeafColorClass,
  renderParagraph,
  renderText,
} from './text';
import type {
  TextLeaf,
  ParagraphNode,
  TextShape,
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

describe('textLeafToClasses', () => {
  it('returns empty for a bare leaf', () => {
    const { classes, style } = textLeafToClasses(makeLeaf());
    expect(classes).toBe('');
    expect(style).toBe('');
  });

  it('maps fontSize to text-[Npx]', () => {
    const { classes } = textLeafToClasses(makeLeaf({ fontSize: '16' }));
    expect(classes).toContain('text-[16px]');
  });

  it('maps fontWeight to font-[N]', () => {
    const { classes } = textLeafToClasses(makeLeaf({ fontWeight: '700' }));
    expect(classes).toContain('font-[700]');
  });

  it('maps fontStyle italic to italic class', () => {
    const { classes } = textLeafToClasses(makeLeaf({ fontStyle: 'italic' }));
    expect(classes).toContain('italic');
  });

  it('maps textDecoration underline', () => {
    const { classes } = textLeafToClasses(
      makeLeaf({ textDecoration: 'underline' }),
    );
    expect(classes).toContain('underline');
  });

  it('maps textDecoration line-through', () => {
    const { classes } = textLeafToClasses(
      makeLeaf({ textDecoration: 'line-through' }),
    );
    expect(classes).toContain('line-through');
  });

  it('maps textTransform uppercase', () => {
    const { classes } = textLeafToClasses(
      makeLeaf({ textTransform: 'uppercase' }),
    );
    expect(classes).toContain('uppercase');
  });

  it('maps textTransform lowercase', () => {
    const { classes } = textLeafToClasses(
      makeLeaf({ textTransform: 'lowercase' }),
    );
    expect(classes).toContain('lowercase');
  });

  it('maps textTransform capitalize', () => {
    const { classes } = textLeafToClasses(
      makeLeaf({ textTransform: 'capitalize' }),
    );
    expect(classes).toContain('capitalize');
  });

  it('maps letterSpacing to inline letter-spacing style in em', () => {
    const { style } = textLeafToClasses(makeLeaf({ letterSpacing: '2' }));
    expect(style).toContain('letter-spacing: 2em');
  });

  it('maps lineHeight to inline line-height style', () => {
    const { style } = textLeafToClasses(makeLeaf({ lineHeight: '1.5' }));
    expect(style).toContain('line-height: 1.5');
  });

  it('maps fontFamily to inline font-family style', () => {
    const { style } = textLeafToClasses(makeLeaf({ fontFamily: 'Inter' }));
    expect(style).toContain("font-family: 'Inter'");
  });
});

describe('textLeafToClasses with typography resolution', () => {
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
    const { classes, style } = textLeafToClasses(
      makeLeaf({ typographyRefId: 'typo-1' as Uuid }),
      typos,
    );
    expect(classes).toContain('text-[24px]');
    expect(classes).toContain('font-[700]');
    expect(style).toContain("font-family: 'Inter'");
  });

  it('leaf inline values override typography defaults', () => {
    const typos: Record<string, Typography> = {
      'typo-1': makeTypography({ fontSize: '24' }),
    };
    const { classes } = textLeafToClasses(
      makeLeaf({ typographyRefId: 'typo-1' as Uuid, fontSize: '32' }),
      typos,
    );
    expect(classes).toContain('text-[32px]');
    expect(classes).not.toContain('text-[24px]');
  });

  it('ignores missing typography ref gracefully', () => {
    const typos: Record<string, Typography> = {};
    const { classes } = textLeafToClasses(
      makeLeaf({ typographyRefId: 'missing' as Uuid, fontSize: '16' }),
      typos,
    );
    expect(classes).toContain('text-[16px]');
  });

  it('works without typographies parameter (no change)', () => {
    const { classes } = textLeafToClasses(makeLeaf({ fontSize: '14' }));
    expect(classes).toContain('text-[14px]');
  });
});

describe('textLeafColorClass', () => {
  it('returns empty string when no fills', () => {
    expect(textLeafColorClass(makeLeaf())).toBe('');
  });

  it('returns text-[#color] for solid fill', () => {
    const result = textLeafColorClass(
      makeLeaf({ fills: [{ fillColor: '#ff0000' as HexColor }] }),
    );
    expect(result).toContain('text-[#ff0000]');
  });

  it('returns text-[rgba(...)] for solid fill with opacity', () => {
    const result = textLeafColorClass(
      makeLeaf({
        fills: [{ fillColor: '#ff0000' as HexColor, fillOpacity: 0.5 }],
      }),
    );
    expect(result).toContain('text-[rgba(');
  });
});

const makeParagraph = (
  overrides: Partial<ParagraphNode> = {},
): ParagraphNode => ({
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
    const html = renderParagraph(
      makeParagraph({ children: [makeLeaf({ text: 'World' })] }),
    );
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

  it('applies paragraph-level font size', () => {
    const html = renderParagraph(makeParagraph({ fontSize: '20' }));
    expect(html).toContain('text-[20px]');
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
        children: [
          {
            type: 'paragraph',
            children: [{ text: 'Hello world' }],
          },
        ],
      },
    ],
  },
  ...overrides,
});

describe('renderText', () => {
  it('renders a div with data-id', () => {
    const html = renderText(makeTextShape(), ctx);
    expect(html).toContain('data-id="text-1"');
  });

  it('renders text content', () => {
    const html = renderText(makeTextShape(), ctx);
    expect(html).toContain('Hello world');
  });

  it('renders empty div when content is null', () => {
    const html = renderText(makeTextShape({ content: null }), ctx);
    expect(html).toContain('data-id="text-1"');
    expect(html).not.toContain('Hello');
  });

  it('applies absolute positioning', () => {
    const html = renderText(makeTextShape(), ctx);
    expect(html).toContain('absolute');
    expect(html).toContain('left-[10px]');
    expect(html).toContain('top-[20px]');
  });

  it('applies width and height', () => {
    const html = renderText(makeTextShape(), ctx);
    expect(html).toContain('w-[200px]');
    expect(html).toContain('h-[50px]');
  });
});
