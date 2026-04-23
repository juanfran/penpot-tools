import { getFileSummaryFn } from '#/lib/server/penpot-api';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ExternalLink } from 'lucide-react';

export const getFileSummaryQueryOptions = (fileId: string) =>
  queryOptions({
    queryKey: ['get-file', fileId],
    queryFn: () => getFileSummaryFn({ data: { fileId } }),
  });

export type PageHeaderView = 'workspace' | 'tokens';

const VIEW_LABEL: Record<PageHeaderView, string> = {
  workspace: 'Workspace',
  tokens: 'Tokens',
};

export function PageHeader({
  fileId,
  pageId,
  teamId,
  view,
  pageName,
}: {
  fileId: string;
  pageId: string;
  teamId: string | undefined;
  view: PageHeaderView;
  /** Optional page name shown as a breadcrumb segment next to the file name. */
  pageName?: string;
}) {
  const { data: file } = useSuspenseQuery(getFileSummaryQueryOptions(fileId));

  const penpotParams = new URLSearchParams({ 'file-id': fileId, 'page-id': pageId });
  if (teamId) penpotParams.set('team-id', teamId);
  const penpotUrl = `https://design.penpot.app/#/workspace?${penpotParams.toString()}`;

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4">
      <Link
        to="/"
        search={{ teamId }}
        className="text-sm font-semibold text-gray-900 hover:text-gray-600"
      >
        Penpot Viewer
      </Link>
      <span className="text-gray-300">/</span>
      <span className="text-sm text-gray-600">{file.name}</span>
      {pageName && (
        <>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-900">{pageName}</span>
        </>
      )}
      {view === 'tokens' && (
        <span className="ml-2 rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-medium text-white">
          {VIEW_LABEL.tokens}
        </span>
      )}
      <div className="ml-auto flex items-center gap-4">
        {view === 'tokens' ? (
          <Link
            to="/workspace/$fileId/$pageId"
            params={{ fileId, pageId }}
            search={{ teamId }}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            {VIEW_LABEL.workspace}
          </Link>
        ) : (
          <Link
            to="/tokens/$fileId/$pageId"
            params={{ fileId, pageId }}
            search={{ teamId }}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            {VIEW_LABEL.tokens}
          </Link>
        )}
        <a
          href={penpotUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          Open in Penpot <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </header>
  );
}

export function PageHeaderFallback() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4">
      <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
      <span className="text-gray-300">/</span>
      <div className="h-3 w-40 animate-pulse rounded bg-gray-100" />
      <div className="ml-auto h-3 w-24 animate-pulse rounded bg-gray-100" />
    </header>
  );
}
