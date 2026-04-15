import { getPageFn } from '#/lib/server/penpot-api';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';

const getPageOptions = (fileId: string, pageId: string) => {
  return queryOptions({
    queryKey: ['get-page', fileId, pageId],
    queryFn: async () => {
      return getPageFn({ data: { fileId, pageId } });
    },
  });
};

export const Render = ({ pageId, fileId }: { pageId: string; fileId: string }) => {
  const page = useSuspenseQuery(getPageOptions(fileId, pageId));

  console.log({ page: page.data });

  return <div>Hello Render!</div>;
};
