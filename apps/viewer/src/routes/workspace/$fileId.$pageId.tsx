import { getPageHtmlOptions, Render } from '#/components/render';
import { getFileSummaryFn } from '#/lib/server/penpot-api';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { Suspense } from 'react';
import { z } from 'zod';

const getFileSummaryQueryOptions = (fileId: string) => {
  return queryOptions({
    queryKey: ['get-file', fileId],
    queryFn: () => {
      return getFileSummaryFn({ data: { fileId } });
    },
  });
};

export const Route = createFileRoute('/workspace/$fileId/$pageId')({
  validateSearch: z.object({
    teamId: z.string().optional(),
  }).parse,
  component: RouteComponent,
  beforeLoad: async ({ params, search, context }) => {
    if (params.pageId !== '0000-0000-0000-0000') {
      return;
    }

    const file = await context.queryClient.ensureQueryData(
      getFileSummaryQueryOptions(params.fileId),
    );

    const firstPageId = file.data.pages[0];
    if (!firstPageId) {
      throw new Error('File has no pages');
    }
    throw redirect({
      to: '/workspace/$fileId/$pageId',
      params: { fileId: params.fileId, pageId: firstPageId },
      search: { teamId: search.teamId },
      replace: true,
    });
  },
  loader: async ({ params, context }) => {
    context.queryClient.prefetchQuery(getPageHtmlOptions(params.fileId, params.pageId));

    return await context.queryClient.ensureQueryData(getFileSummaryQueryOptions(params.fileId));
  },
});

function Header({ fileId }: { fileId: string }) {
  const { data: file } = useSuspenseQuery(getFileSummaryQueryOptions(fileId));
  const { teamId } = Route.useSearch();

  return (
    <header className="flex h-12 items-center gap-3 border-b border-gray-200 px-4">
      <Link
        to="/"
        search={{ teamId }}
        className="text-sm font-semibold text-gray-900 hover:text-gray-600"
      >
        Penpot Viewer
      </Link>
      <span className="text-gray-300">/</span>
      <span className="text-sm text-gray-600">{file.name}</span>
    </header>
  );
}

function PagesSidebar({ fileId }: { fileId: string }) {
  const { data: file } = useSuspenseQuery(getFileSummaryQueryOptions(fileId));

  return (
    <aside className="flex w-48 flex-col gap-1 border-r border-gray-200 p-3">
      {file.data.pages.map((pageId) => {
        const page = file.data.pagesIndex[pageId];
        return (
          <Link
            key={pageId}
            to="/workspace/$fileId/$pageId"
            params={{ fileId, pageId }}
            search={{ teamId: Route.useSearch().teamId ?? undefined }}
            className="rounded px-2 py-1 text-sm hover:bg-gray-100"
            activeProps={{ className: 'rounded px-2 py-1 text-sm bg-gray-200 font-medium' }}
          >
            {page?.name ?? pageId}
          </Link>
        );
      })}
    </aside>
  );
}

function RouteComponent() {
  const { fileId, pageId } = Route.useParams();

  return (
    <div className="flex h-screen flex-col">
      <Suspense fallback={<header className="h-12 border-b border-gray-200" />}>
        <Header fileId={fileId} />
      </Suspense>
      <div className="flex flex-1 overflow-hidden">
        <Suspense fallback={<aside className="w-48 border-r border-gray-200" />}>
          <PagesSidebar fileId={fileId} />
        </Suspense>
        <main className="relative flex-1 overflow-auto">
          <Suspense fallback={<div>Loading...</div>}>
            <Render fileId={fileId} pageId={pageId} />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
