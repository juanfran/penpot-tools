import { describe, it, expect } from 'vitest';
import { flexContainerStyle, flexSpacingStyle } from './flex';
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

describe('flexContainerStyle', () => {
  it('always includes display: flex', () => {
    expect(flexContainerStyle(makeFrame())).toContain('display: flex;');
  });

  it('maps row direction to flex-direction: row', () => {
    expect(flexContainerStyle(makeFrame({ layoutFlexDir: 'row' }))).toContain(
      'flex-direction: row;',
    );
  });

  it('maps column direction to flex-direction: column', () => {
    expect(flexContainerStyle(makeFrame({ layoutFlexDir: 'column' }))).toContain(
      'flex-direction: column;',
    );
  });

  it('maps row-reverse to flex-direction: row (Penpot stores reverse children in visual order)', () => {
    const result = flexContainerStyle(makeFrame({ layoutFlexDir: 'row-reverse' }));
    expect(result).toContain('flex-direction: row;');
    expect(result).not.toContain('row-reverse');
  });

  it('maps column-reverse to flex-direction: column', () => {
    const result = flexContainerStyle(makeFrame({ layoutFlexDir: 'column-reverse' }));
    expect(result).toContain('flex-direction: column;');
    expect(result).not.toContain('column-reverse');
  });

  it('maps alignItems start to align-items: flex-start', () => {
    expect(flexContainerStyle(makeFrame({ layoutAlignItems: 'start' }))).toContain(
      'align-items: flex-start;',
    );
  });

  it('maps alignItems center to align-items: center', () => {
    expect(flexContainerStyle(makeFrame({ layoutAlignItems: 'center' }))).toContain(
      'align-items: center;',
    );
  });

  it('maps alignItems end to align-items: flex-end', () => {
    expect(flexContainerStyle(makeFrame({ layoutAlignItems: 'end' }))).toContain(
      'align-items: flex-end;',
    );
  });

  it('maps alignItems stretch to align-items: stretch', () => {
    expect(flexContainerStyle(makeFrame({ layoutAlignItems: 'stretch' }))).toContain(
      'align-items: stretch;',
    );
  });

  it('maps justifyContent start to justify-content: flex-start', () => {
    expect(flexContainerStyle(makeFrame({ layoutJustifyContent: 'start' }))).toContain(
      'justify-content: flex-start;',
    );
  });

  it('maps justifyContent center to justify-content: center', () => {
    expect(flexContainerStyle(makeFrame({ layoutJustifyContent: 'center' }))).toContain(
      'justify-content: center;',
    );
  });

  it('maps justifyContent end to justify-content: flex-end', () => {
    expect(flexContainerStyle(makeFrame({ layoutJustifyContent: 'end' }))).toContain(
      'justify-content: flex-end;',
    );
  });

  it('maps justifyContent space-between to justify-content: space-between', () => {
    expect(flexContainerStyle(makeFrame({ layoutJustifyContent: 'space-between' }))).toContain(
      'justify-content: space-between;',
    );
  });

  it('maps justifyContent space-around to justify-content: space-around', () => {
    expect(flexContainerStyle(makeFrame({ layoutJustifyContent: 'space-around' }))).toContain(
      'justify-content: space-around;',
    );
  });

  it('maps justifyContent space-evenly to justify-content: space-evenly', () => {
    expect(flexContainerStyle(makeFrame({ layoutJustifyContent: 'space-evenly' }))).toContain(
      'justify-content: space-evenly;',
    );
  });

  it('maps wrap to flex-wrap: wrap', () => {
    expect(flexContainerStyle(makeFrame({ layoutWrapType: 'wrap' }))).toContain('flex-wrap: wrap;');
  });

  it('maps no-wrap to flex-wrap: nowrap', () => {
    expect(flexContainerStyle(makeFrame({ layoutWrapType: 'no-wrap' }))).toContain(
      'flex-wrap: nowrap;',
    );
  });

  it('combines multiple layout properties', () => {
    const result = flexContainerStyle(
      makeFrame({
        layoutFlexDir: 'column',
        layoutAlignItems: 'center',
        layoutJustifyContent: 'space-between',
        layoutWrapType: 'wrap',
      }),
    );
    expect(result).toContain('display: flex;');
    expect(result).toContain('flex-direction: column;');
    expect(result).toContain('align-items: center;');
    expect(result).toContain('justify-content: space-between;');
    expect(result).toContain('flex-wrap: wrap;');
  });
});

describe('flexSpacingStyle', () => {
  it('returns empty string when no gap or padding', () => {
    expect(flexSpacingStyle(makeFrame())).toBe('');
  });

  it('emits gap: Npx when row and column gap are equal', () => {
    expect(flexSpacingStyle(makeFrame({ layoutRowGap: 8, layoutColumnGap: 8 }))).toContain(
      'gap: 8px;',
    );
  });

  it('emits row-gap and column-gap when gaps differ', () => {
    const result = flexSpacingStyle(makeFrame({ layoutRowGap: 4, layoutColumnGap: 8 }));
    expect(result).toContain('column-gap: 8px;');
    expect(result).toContain('row-gap: 4px;');
  });

  it('emits row-gap when only rowGap is set', () => {
    expect(flexSpacingStyle(makeFrame({ layoutRowGap: 16 }))).toContain('row-gap: 16px;');
  });

  it('emits padding: Npx when all paddings are equal', () => {
    const result = flexSpacingStyle(
      makeFrame({ layoutPadding: { p1: 12, p2: 12, p3: 12, p4: 12 } }),
    );
    expect(result).toContain('padding: 12px;');
  });

  it('emits 4-value padding when sides differ', () => {
    const result = flexSpacingStyle(makeFrame({ layoutPadding: { p1: 4, p2: 8, p3: 12, p4: 16 } }));
    expect(result).toContain('padding: 4px 8px 12px 16px;');
  });
});
