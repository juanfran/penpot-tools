import { Render } from '#/components/render';
import { getFileSummaryFn } from '#/lib/server/penpot-api';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { Suspense } from 'react';

const getFileSummaryQueryOptions = (fileId: string) => {
  return queryOptions({
    queryKey: ['get-file', fileId],
    queryFn: async () => {
      return getFileSummaryFn({ data: { fileId } });
    },
  });
};

export const Route = createFileRoute('/workspace/$fileId/$pageId')({
  component: RouteComponent,
  beforeLoad: async ({ params, context }) => {
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
      replace: true,
    });
  },
});

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
    <div className="flex h-screen">
      <Suspense fallback={<aside className="w-48 border-r border-gray-200" />}>
        <PagesSidebar fileId={fileId} />
      </Suspense>
      <main className="relative flex-1 overflow-auto">
        <Suspense fallback={<div>Loading...</div>}>
          <Render fileId={fileId} pageId={pageId} />
        </Suspense>
      </main>
    </div>
  );
}
