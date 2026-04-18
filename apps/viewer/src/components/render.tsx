import { useRef, useState, useEffect, memo } from 'react';
import { getPageShapesFn } from '#/lib/server/penpot-api';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import {
  TransformWrapper,
  TransformComponent,
  useControls,
  Virtualize,
} from 'react-zoom-pan-pinch';

const VISIBILITY_MARGIN = 500;

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

const ShapeNode = memo(({ html }: { html: string }) => (
  <div dangerouslySetInnerHTML={{ __html: html }} />
));

export const getPageShapesOptions = (fileId: string, pageId: string) =>
  queryOptions({
    queryKey: ['get-page-shapes', fileId, pageId],
    queryFn: () => getPageShapesFn({ data: { fileId, pageId } }),
  });

export const Render = ({ pageId, fileId }: { pageId: string; fileId: string }) => {
  const { data } = useSuspenseQuery(getPageShapesOptions(fileId, pageId));

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <title>{data.name}</title>
      {data.googleFontsUrls && data.googleFontsUrls.length > 0 && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          {data.googleFontsUrls.map((url) => (
            <link key={url} rel="stylesheet" href={url} />
          ))}
        </>
      )}
      {data.tokensCss && <style>{data.tokensCss}</style>}

      <div ref={containerRef} className="relative h-full w-full bg-[#e8e9ea] contain-strict">
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
              className="pointer-events-none relative"
              style={{ width: containerSize.width, height: containerSize.height }}
            >
              {data.shapes.map((shape) => (
                <Virtualize
                  key={shape.id}
                  x={shape.x}
                  y={shape.y}
                  width={shape.width}
                  height={shape.height}
                  margin={VISIBILITY_MARGIN}
                >
                  <ShapeNode html={shape.html} />
                </Virtualize>
              ))}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>
    </>
  );
};
