import { describe, it, expect } from 'vitest';
import { flexContainerClasses, flexSpacingClasses } from './flex';
import type { FrameShape, Uuid } from '../../penpot.types';

const makeFrame = (overrides: Partial<FrameShape> = {}): FrameShape => ({
  id: 'frame-1' as Uuid,
  name: 'Frame',
  type: 'frame',
  x: 0,
  y: 0,
  width: 400,
  height: 300,
  shapes: [],
  selrect: { x: 0, y: 0, width: 400, height: 300 },
  points: [],
  transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  parentId: 'frame-1' as Uuid,
  frameId: 'frame-1' as Uuid,
  layoutType: 'flex',
  ...overrides,
});

describe('flexContainerClasses', () => {
  it('always includes flex class', () => {
    const result = flexContainerClasses(makeFrame());
    expect(result).toContain('flex');
  });

  it('maps row direction to flex-row', () => {
    const result = flexContainerClasses(makeFrame({ layoutFlexDir: 'row' }));
    expect(result).toContain('flex-row');
  });

  it('maps column direction to flex-col', () => {
    const result = flexContainerClasses(makeFrame({ layoutFlexDir: 'column' }));
    expect(result).toContain('flex-col');
  });

  it('maps row-reverse to flex-row (Penpot stores reverse children in visual order)', () => {
    const result = flexContainerClasses(makeFrame({ layoutFlexDir: 'row-reverse' }));
    expect(result).toContain('flex-row');
    expect(result).not.toContain('flex-row-reverse');
  });

  it('maps column-reverse to flex-col (Penpot stores reverse children in visual order)', () => {
    const result = flexContainerClasses(makeFrame({ layoutFlexDir: 'column-reverse' }));
    expect(result).toContain('flex-col');
    expect(result).not.toContain('flex-col-reverse');
  });

  it('maps alignItems start to items-start', () => {
    const result = flexContainerClasses(makeFrame({ layoutAlignItems: 'start' }));
    expect(result).toContain('items-start');
  });

  it('maps alignItems center to items-center', () => {
    const result = flexContainerClasses(makeFrame({ layoutAlignItems: 'center' }));
    expect(result).toContain('items-center');
  });

  it('maps alignItems end to items-end', () => {
    const result = flexContainerClasses(makeFrame({ layoutAlignItems: 'end' }));
    expect(result).toContain('items-end');
  });

  it('maps alignItems stretch to items-stretch', () => {
    const result = flexContainerClasses(makeFrame({ layoutAlignItems: 'stretch' }));
    expect(result).toContain('items-stretch');
  });

  it('maps justifyContent start to justify-start', () => {
    const result = flexContainerClasses(makeFrame({ layoutJustifyContent: 'start' }));
    expect(result).toContain('justify-start');
  });

  it('maps justifyContent center to justify-center', () => {
    const result = flexContainerClasses(makeFrame({ layoutJustifyContent: 'center' }));
    expect(result).toContain('justify-center');
  });

  it('maps justifyContent end to justify-end', () => {
    const result = flexContainerClasses(makeFrame({ layoutJustifyContent: 'end' }));
    expect(result).toContain('justify-end');
  });

  it('maps justifyContent space-between to justify-between', () => {
    const result = flexContainerClasses(makeFrame({ layoutJustifyContent: 'space-between' }));
    expect(result).toContain('justify-between');
  });

  it('maps justifyContent space-around to justify-around', () => {
    const result = flexContainerClasses(makeFrame({ layoutJustifyContent: 'space-around' }));
    expect(result).toContain('justify-around');
  });

  it('maps justifyContent space-evenly to justify-evenly', () => {
    const result = flexContainerClasses(makeFrame({ layoutJustifyContent: 'space-evenly' }));
    expect(result).toContain('justify-evenly');
  });

  it('maps wrap to flex-wrap', () => {
    const result = flexContainerClasses(makeFrame({ layoutWrapType: 'wrap' }));
    expect(result).toContain('flex-wrap');
  });

  it('maps no-wrap to flex-nowrap', () => {
    const result = flexContainerClasses(makeFrame({ layoutWrapType: 'no-wrap' }));
    expect(result).toContain('flex-nowrap');
  });

  it('combines multiple layout properties', () => {
    const result = flexContainerClasses(
      makeFrame({
        layoutFlexDir: 'column',
        layoutAlignItems: 'center',
        layoutJustifyContent: 'space-between',
        layoutWrapType: 'wrap',
      }),
    );
    expect(result).toContain('flex');
    expect(result).toContain('flex-col');
    expect(result).toContain('items-center');
    expect(result).toContain('justify-between');
    expect(result).toContain('flex-wrap');
  });
});

describe('flexSpacingClasses', () => {
  it('returns empty when no gap or padding', () => {
    const result = flexSpacingClasses(makeFrame());
    expect(result.classes).toBe('');
    expect(result.style).toBe('');
  });

  it('emits gap-[Npx] when row and column gap are equal', () => {
    const result = flexSpacingClasses(makeFrame({ layoutRowGap: 8, layoutColumnGap: 8 }));
    expect(result.classes).toContain('gap-[8px]');
  });

  it('emits gap-x and gap-y when gaps differ', () => {
    const result = flexSpacingClasses(makeFrame({ layoutRowGap: 4, layoutColumnGap: 8 }));
    expect(result.classes).toContain('gap-x-[8px]');
    expect(result.classes).toContain('gap-y-[4px]');
  });

  it('emits gap when only rowGap is set', () => {
    const result = flexSpacingClasses(makeFrame({ layoutRowGap: 16 }));
    expect(result.classes).toContain('gap-y-[16px]');
  });

  it('emits p-[Npx] when all paddings are equal', () => {
    const result = flexSpacingClasses(
      makeFrame({ layoutPadding: { p1: 12, p2: 12, p3: 12, p4: 12 } }),
    );
    expect(result.classes).toContain('p-[12px]');
  });

  it('emits px and py when top=bottom and left=right', () => {
    const result = flexSpacingClasses(
      makeFrame({ layoutPadding: { p1: 8, p2: 16, p3: 8, p4: 16 } }),
    );
    expect(result.classes).toContain('px-[16px]');
    expect(result.classes).toContain('py-[8px]');
  });

  it('emits inline padding style when all sides differ', () => {
    const result = flexSpacingClasses(
      makeFrame({ layoutPadding: { p1: 4, p2: 8, p3: 12, p4: 16 } }),
    );
    expect(result.style).toContain('padding: 4px 8px 12px 16px;');
    expect(result.classes).toBe('');
  });
});
