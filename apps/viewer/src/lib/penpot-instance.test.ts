import { describe, expect, it } from 'vitest';
import { normalizePenpotUrl, penpotWorkspaceUrl } from './penpot-instance';

describe('normalizePenpotUrl', () => {
  it.each([
    ['https://design.penpot.app', 'https://design.penpot.app'],
    ['https://design.penpot.app/', 'https://design.penpot.app'],
    ['  penpot.example.com  ', 'https://penpot.example.com'],
    ['http://localhost:9001', 'http://localhost:9001'],
    ['localhost:9001/', 'http://localhost:9001'],
    ['127.0.0.1:9001', 'http://127.0.0.1:9001'],
    ['penpot.localhost', 'http://penpot.localhost'],
    ['https://localhost:9001', 'https://localhost:9001'],
    ['localhost.example.com', 'https://localhost.example.com'],
    ['https://penpot.example.com/api/main', 'https://penpot.example.com'],
    ['https://penpot.example.com/api/rpc/command/get-profile', 'https://penpot.example.com'],
    ['https://example.com/penpot/', 'https://example.com/penpot'],
    ['https://penpot.example.com/#/workspace?file-id=a&page-id=b', 'https://penpot.example.com'],
    ['https://penpot.example.com/?screen=workspace&file-id=a', 'https://penpot.example.com'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePenpotUrl(input)).toBe(expected);
  });

  it('rejects empty input and non-http schemes', () => {
    expect(() => normalizePenpotUrl('   ')).toThrow(/required/);
    expect(() => normalizePenpotUrl('ftp://penpot.example.com')).toThrow(/http/);
    expect(() => normalizePenpotUrl('https://')).toThrow(/valid URL/);
  });
});

describe('penpotWorkspaceUrl', () => {
  it('builds a workspace link on the given instance', () => {
    expect(
      penpotWorkspaceUrl('https://penpot.example.com', { fileId: 'f', pageId: 'p', teamId: 't' }),
    ).toBe('https://penpot.example.com/?screen=workspace&file-id=f&page-id=p&team-id=t');
  });
});
