import { getPageHtmlFn } from '#/lib/server/penpot-api';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';

const ZoomControls = () => {
  const { zoomIn, zoomOut, resetTransform } = useControls();

  return (
    <div className="absolute right-4 bottom-4 z-50 flex items-center gap-1 rounded-xl border border-white/10 bg-black/60 p-1 shadow-xl backdrop-blur-sm">
      <button
        onClick={() => zoomIn()}
        className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        title="Zoom in"
      >
        <ZoomIn size={16} />
      </button>
      <div className="h-4 w-px bg-white/20" />
      <button
        onClick={() => zoomOut()}
        className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        title="Zoom out"
      >
        <ZoomOut size={16} />
      </button>
      <div className="h-4 w-px bg-white/20" />
      <button
        onClick={() => resetTransform()}
        className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        title="Reset zoom"
      >
        <Maximize size={16} />
      </button>
    </div>
  );
};

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

      <div className="relative h-full w-full">
        <TransformWrapper
          minScale={0.05}
          maxScale={10}
          limitToBounds={false}
          centerOnInit={true}
          smooth={false}
          wheel={{ step: 0.1 }}
        >
          <ZoomControls />
          <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
            <div
              className="pointer-events-none relative h-[3000px] w-[3000px] contain-strict"
              dangerouslySetInnerHTML={{ __html: data.html }}
            />
          </TransformComponent>
        </TransformWrapper>
      </div>
    </>
  );
};
