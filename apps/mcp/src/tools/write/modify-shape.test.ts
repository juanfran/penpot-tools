import { describe, expect, it } from 'vitest';
import type { HexColor, TextContent } from '@penpot-tools/converter/types';
import { rebuildTextContent } from './modify-shape.ts';

function baseContent(text: string): TextContent {
  return {
    type: 'root',
    verticalAlign: 'top',
    children: [
      {
        type: 'paragraph-set',
        children: [
          {
            type: 'paragraph',
            fontFamily: 'Inter',
            fontSize: '16',
            fontWeight: '500',
            fontStyle: 'normal',
            lineHeight: '1.4',
            letterSpacing: '0',
            textAlign: 'left',
            children: [
              {
                text,
                fontFamily: 'Inter',
                fontSize: '16',
                fontWeight: '500',
                fontStyle: 'normal',
                lineHeight: '1.4',
                letterSpacing: '0',
                textAlign: 'left',
                textDecoration: 'none',
                textTransform: 'none',
                fills: [{ fillColor: '#1B1B1A' as HexColor, fillOpacity: 1 }],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('rebuildTextContent', () => {
  it('replaces the leaf text while keeping font, size, colour and alignment', () => {
    const before = baseContent('Original');
    const after = rebuildTextContent(before, 'Updated')!;

    const beforeLeaf = before.children[0].children[0].children[0]!;
    const afterLeaf = after.children[0].children[0].children[0]!;

    expect(afterLeaf.text).toBe('Updated');
    expect(afterLeaf.fontFamily).toBe(beforeLeaf.fontFamily);
    expect(afterLeaf.fontSize).toBe(beforeLeaf.fontSize);
    expect(afterLeaf.fontWeight).toBe(beforeLeaf.fontWeight);
    expect(afterLeaf.fills).toEqual(beforeLeaf.fills);
  });

  it('splits multi-line input into one paragraph per line', () => {
    const before = baseContent('One');
    const after = rebuildTextContent(before, 'Line 1\nLine 2\nLine 3')!;

    const paragraphs = after.children[0].children;
    expect(paragraphs.length).toBe(3);
    expect(paragraphs[0]!.children[0]!.text).toBe('Line 1');
    expect(paragraphs[1]!.children[0]!.text).toBe('Line 2');
    expect(paragraphs[2]!.children[0]!.text).toBe('Line 3');
    // Each new paragraph clones the source typography.
    expect(paragraphs[1]!.fontFamily).toBe('Inter');
  });

  it('preserves the verticalAlign on the root', () => {
    const before: TextContent = { ...baseContent('hi'), verticalAlign: 'center' };
    const after = rebuildTextContent(before, 'bye')!;
    expect(after.verticalAlign).toBe('center');
  });

  it('returns null for a content tree with no leaves', () => {
    const empty = {
      type: 'root',
      children: [{ type: 'paragraph-set', children: [] }],
    } as unknown as TextContent;
    expect(rebuildTextContent(empty, 'anything')).toBeNull();
  });
});
