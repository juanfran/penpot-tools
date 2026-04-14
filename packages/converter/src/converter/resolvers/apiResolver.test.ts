import { describe, it, expect } from 'vitest';
import { createApiResolver } from './apiResolver';
import type { Uuid } from '../../penpot.types';

describe('createApiResolver', () => {
  it('constructs a URL with fileId and objectId', () => {
    const resolve = createApiResolver('https://design.penpot.app', 'file-123' as Uuid, 'token-abc');
    const url = resolve('img-456' as Uuid);
    expect(url).toContain('file-id=file-123');
    expect(url).toContain('object-id=img-456');
    expect(url).toContain('https://design.penpot.app');
  });

  it('does not perform any fetch (synchronous)', () => {
    const resolve = createApiResolver('https://design.penpot.app', 'file-1' as Uuid, 'token');
    // Should return immediately with a string, no async
    const result = resolve('img-1' as Uuid);
    expect(typeof result).toBe('string');
  });

  it('trims trailing slash from apiBase', () => {
    const resolve = createApiResolver('https://design.penpot.app/', 'file-1' as Uuid, 'token');
    const url = resolve('img-1' as Uuid);
    expect(url).not.toContain('//api');
  });
});
