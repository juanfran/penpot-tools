import { describe, it, expect } from 'vitest';
import { createFileResolver, buildFilePath } from './fileResolver';
import type { Uuid } from '../../penpot.types';

describe('buildFilePath', () => {
  it('builds the correct file:// URL', () => {
    expect(buildFilePath('/assets', 'abc123' as Uuid)).toBe('file:///assets/images/abc123.png');
  });

  it('uses the baseDir correctly', () => {
    expect(buildFilePath('/home/user/penpot', 'img-1' as Uuid)).toBe(
      'file:///home/user/penpot/images/img-1.png',
    );
  });
});

describe('createFileResolver', () => {
  it('returns placeholder data URI when file does not exist', () => {
    const resolve = createFileResolver('/nonexistent/path/that/does/not/exist');
    const url = resolve('missing-id' as Uuid);
    expect(url).toMatch(/^data:image\/png;base64,/);
  });

  it('returns a string for any input', () => {
    const resolve = createFileResolver('/some/dir');
    const url = resolve('any-id' as Uuid);
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
  });
});
