import { getPageHtmlFn } from '#/lib/server/penpot-api';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';

export const getPageHtmlOptions = (fileId: string, pageId: string) => {
  return queryOptions({
    queryKey: ['get-page-html', fileId, pageId],
    queryFn: async () => {
      return getPageHtmlFn({ data: { fileId, pageId } });
    },
  });
};

export const Render = ({ pageId, fileId }: { pageId: string; fileId: string }) => {
  const { data } = useSuspenseQuery(getPageHtmlOptions(fileId, pageId));

  return (
    <>
      {data.googleFontsUrl && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link rel="stylesheet" href={data.googleFontsUrl} />
        </>
      )}
      {data.tokensCss && <style>{data.tokensCss}</style>}
      <div className="contain-strict" dangerouslySetInnerHTML={{ __html: data.html }} />
    </>
  );
};
