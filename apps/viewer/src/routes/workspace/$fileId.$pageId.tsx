import { getFileSummaryFn } from '#/lib/server/penpot-api';
import { queryOptions } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';

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
  loader: () => {
    console.log('Loading page route');
    return true;
  },
});

function RouteComponent() {
  return <div>Hello "/workspace/$fileId/$pageId"!</div>;
}
