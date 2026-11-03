import { describe, expect, it } from 'vitest';
import { parsePenpotLocation } from './penpot-location';

const fileId = 'a234c67f-eb39-8116-8008-402ac4573036';
const pageId = '307d6f7f-da91-80b3-8008-cae31ef7d009';
const teamId = '8fd8c29f-33f9-8038-8007-28bdc8c029f0';

describe('parsePenpotLocation', () => {
  it('reads the query parameters of a Penpot URL embedded in /r/', () => {
    const location = new URL(
      `http://localhost:3000/r/https:/design.penpot.app?screen=workspace&team-id=${teamId}&file-id=${fileId}&page-id=${pageId}&layout=layers`,
    );

    expect(parsePenpotLocation(location)).toEqual({
      fileId,
      pageId,
      teamId,
      shapeId: undefined,
    });
  });

  it.each([
    `http://localhost:3000/r/https://design.penpot.app/?screen=workspace&file-id=${fileId}&page-id=${pageId}&board-id=board`,
    `http://localhost:3000/r/https://design.penpot.app/#/workspace?file-id=${fileId}&page-id=${pageId}&board-id=board`,
  ])('preserves the board selection for %s', (url) => {
    expect(parsePenpotLocation(new URL(url))).toEqual({
      fileId,
      pageId,
      teamId: undefined,
      shapeId: 'board',
    });
  });

  it.each(['', `?file-id=${fileId}`, `?page-id=${pageId}`, '?file-id=&page-id='])(
    'rejects incomplete locations: %s',
    (query) => {
      expect(parsePenpotLocation({ hash: '', search: query })).toBeNull();
      expect(parsePenpotLocation({ hash: `#/workspace${query}`, search: '' })).toBeNull();
    },
  );
});
