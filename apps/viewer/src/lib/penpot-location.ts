export function parsePenpotLocation({ hash, search }: Pick<Location, 'hash' | 'search'>) {
  const queryIndex = hash.indexOf('?');
  // Legacy links store the query in #/workspace; current links use location.search.
  const params = new URLSearchParams(queryIndex === -1 ? search : hash.slice(queryIndex + 1));
  const fileId = params.get('file-id');
  const pageId = params.get('page-id');
  if (!fileId || !pageId) return null;
  return {
    fileId,
    pageId,
    teamId: params.get('team-id') ?? undefined,
    shapeId: params.get('board-id') ?? undefined,
  };
}
