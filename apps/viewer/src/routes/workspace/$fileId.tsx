import { createFileRoute, redirect } from '@tanstack/react-router';
import { getFileSummaryFn } from '#/lib/server/penpot-api';

export const Route = createFileRoute('/workspace/$fileId')({
  beforeLoad: async ({ params }) => {
    const file = await getFileSummaryFn({ data: { fileId: params.fileId } });
    const firstPageId = file.data.pages[0];
    if (!firstPageId) {
      throw new Error('File has no pages');
    }
    throw redirect({
      to: '/workspace/$fileId/$pageId',
      params: { fileId: params.fileId, pageId: firstPageId },
    });
  },
  component: () => null,
});
