import { getPageHtmlFn } from '#/lib/server/penpot-api';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

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

      <div className="h-full w-full contain-strict">
        <TransformWrapper
          minScale={0.05}
          maxScale={10}
          limitToBounds={false}
          centerOnInit={true}
          smooth={false}
          wheel={{ step: 0.1 }}
        >
          <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
            <div
              className="pointer-events-none relative h-[3000px] w-[3000px]"
              dangerouslySetInnerHTML={{ __html: data.html }}
            />
          </TransformComponent>
        </TransformWrapper>
      </div>
    </>
  );
};
