import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { convertPage } from '../converter/index';
import type { ConverterContext } from '../converter/index';
import type { Page } from '../penpot.types';

const ctx: ConverterContext = {
  resolveImageUrl: (id) => `https://assets.example.com/${id}`,
};

const page = JSON.parse(
  readFileSync(join(__dirname, 'example1.json'), 'utf-8'),
) as Page;

describe('example1 integration', () => {
  it('converts the page to the expected HTML', () => {
    const html = convertPage(page, ctx);

    // Outer frame: 200x95, rounded-[10px], bg-[#101010], flex-col-reverse, padding 12px, gap 10px
    expect(html).toContain('w-[200px]');
    expect(html).toContain('h-[95px]');
    expect(html).toContain('rounded-[10px]');
    expect(html).toContain('bg-[#101010]');
    expect(html).toContain('flex-col-reverse');
    expect(html).toContain('p-[12px]');
    expect(html).toContain('gap-y-[10px]');
    expect(html).toContain('items-start');
    expect(html).toContain('justify-start');

    // Title text: 110x14, font size 14px, sourcesanspro, white, font-normal
    expect(html).toContain('w-[110px]');
    expect(html).toContain('h-[14px]');
    expect(html).toContain("font-['sourcesanspro']");
    expect(html).toContain('text-[14px]');
    expect(html).toContain('font-normal');
    expect(html).toContain('leading-[1.2]');
    expect(html).toContain('text-white');
    expect(html).toContain('Title');

    // Lorem ipsum text: 147x47, font size 8px
    expect(html).toContain('w-[147px]');
    expect(html).toContain('h-[47px]');
    expect(html).toContain('text-[8px]');
    expect(html).toContain('Lorem ipsum dolor sit amet');
  });
});
