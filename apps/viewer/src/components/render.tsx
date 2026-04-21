import {
  useRef,
  useState,
  useEffect,
  memo,
  useImperativeHandle,
  useCallback,
  useMemo,
} from 'react';
import { Debouncer } from '@tanstack/pacer';
import { type ShapeTreeNode, getPageShapesFn } from '#/lib/server/penpot-api';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import {
  TransformWrapper,
  TransformComponent,
  useControls,
  Virtualize,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';

export type RenderHandle = {
  goToShape: (shapeId: string) => void;
};

const VISIBILITY_MARGIN = 500;

const TRANSFORM_STORAGE_PREFIX = 'penpot-viewer:transform';

type SavedTransform = { scale: number; positionX: number; positionY: number };

function transformStorageKey(fileId: string, pageId: string) {
  return `${TRANSFORM_STORAGE_PREFIX}:${fileId}:${pageId}`;
}

function loadTransform(fileId: string, pageId: string): SavedTransform | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(transformStorageKey(fileId, pageId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.scale === 'number' &&
      typeof parsed.positionX === 'number' &&
      typeof parsed.positionY === 'number'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveTransform(fileId: string, pageId: string, state: SavedTransform) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(transformStorageKey(fileId, pageId), JSON.stringify(state));
  } catch {
    /* ignore quota or access errors */
  }
}

function findNodeById(nodes: ShapeTreeNode[], id: string): ShapeTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNodeById(node.children, id);
    if (found) return found;
  }
  return null;
}

function hitTest(node: ShapeTreeNode, x: number, y: number): boolean {
  return x >= node.x && x <= node.x + node.width && y >= node.y && y <= node.y + node.height;
}

// Returns the topmost (last in array = visually on top) child that contains (x, y)
function topChildAt(children: ShapeTreeNode[], x: number, y: number): ShapeTreeNode | null {
  let result: ShapeTreeNode | null = null;
  for (const child of children) {
    if (hitTest(child, x, y)) result = child;
  }
  return result;
}

function findParent(nodes: ShapeTreeNode[], targetId: string): ShapeTreeNode | null {
  for (const node of nodes) {
    if (node.children.some((c) => c.id === targetId)) return node;
    const found = findParent(node.children, targetId);
    if (found) return found;
  }
  return null;
}

// Returns the deepest node that contains (x, y), preferring topmost siblings
function deepestAt(nodes: ShapeTreeNode[], x: number, y: number): ShapeTreeNode | null {
  let result: ShapeTreeNode | null = null;
  for (const node of nodes) {
    if (hitTest(node, x, y)) {
      result = node;
      const deeper = deepestAt(node.children, x, y);
      if (deeper) result = deeper;
    }
  }
  return result;
}

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

export const Render = ({
  pageId,
  fileId,
  selectedShapeId,
  onShapeSelect,
  ref,
}: {
  pageId: string;
  fileId: string;
  selectedShapeId?: string;
  onShapeSelect?: (id: string | undefined) => void;
  ref?: React.Ref<RenderHandle>;
}) => {
  const { data } = useSuspenseQuery(getPageShapesOptions(fileId, pageId));

  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
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

  const goToShape = useCallback(
    (shapeId: string) => {
      const node = findNodeById(data.tree, shapeId);
      const api = transformRef.current;
      if (!node || !api) return;
      const W = containerSize.width;
      const H = containerSize.height;
      if (!W || !H || !node.width || !node.height) return;
      const margin = 0.9;
      const scaleFit = Math.min(W / node.width, H / node.height) * margin;
      const scale = Math.min(Math.max(scaleFit, 0.05), 2);
      const cx = node.x + node.width / 2;
      const cy = node.y + node.height / 2;
      const positionX = W / 2 - scale * cx;
      const positionY = H / 2 - scale * cy;
      api.setTransform(positionX, positionY, scale, 300);
    },
    [data.tree, containerSize],
  );

  useImperativeHandle(ref, () => ({ goToShape }), [goToShape]);

  const initialTransform = useMemo(() => loadTransform(fileId, pageId), [fileId, pageId]);

  const saveDebouncer = useMemo(
    () =>
      new Debouncer((state: SavedTransform) => saveTransform(fileId, pageId, state), {
        wait: 300,
      }),
    [fileId, pageId],
  );

  useEffect(() => {
    return () => {
      saveDebouncer.flush();
    };
  }, [saveDebouncer]);

  const handleTransform = useCallback(
    (_ref: ReactZoomPanPinchRef, state: SavedTransform) => {
      saveDebouncer.maybeExecute(state);
    },
    [saveDebouncer],
  );

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
          key={pageId}
          ref={transformRef}
          minScale={0.05}
          maxScale={10}
          limitToBounds={false}
          centerOnInit={!initialTransform}
          initialScale={initialTransform?.scale}
          initialPositionX={initialTransform?.positionX}
          initialPositionY={initialTransform?.positionY}
          onTransform={handleTransform}
          smooth={false}
          wheel={{ step: 0.1 }}
          doubleClick={{ disabled: true }}
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
              {onShapeSelect && (
                <>
                  <div
                    className="pointer-events-auto absolute inset-0"
                    onClick={() => onShapeSelect(undefined)}
                  />
                  {data.shapes.map((shape) => (
                    <div
                      key={`sel-${shape.id}`}
                      className="pointer-events-auto absolute cursor-pointer"
                      style={{
                        left: shape.x,
                        top: shape.y,
                        width: shape.width,
                        height: shape.height,
                        zIndex: 1,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (e.ctrlKey) {
                          const cx = shape.x + e.nativeEvent.offsetX;
                          const cy = shape.y + e.nativeEvent.offsetY;
                          const hit = deepestAt(data.tree, cx, cy);
                          onShapeSelect(hit?.id ?? shape.id);
                        } else {
                          const cx = shape.x + e.nativeEvent.offsetX;
                          const cy = shape.y + e.nativeEvent.offsetY;
                          const topNode = findNodeById(data.tree, shape.id);
                          const alreadyInside =
                            topNode && selectedShapeId
                              ? findNodeById([topNode], selectedShapeId) !== null
                              : false;
                          if (!alreadyInside) {
                            onShapeSelect(shape.id);
                          } else if (selectedShapeId) {
                            // Walk up from current selection to find something at click pos
                            let currentId: string | null = selectedShapeId;
                            while (currentId) {
                              const parent = findParent(data.tree, currentId);
                              const pool = parent ? parent.children : data.tree;
                              const hit = topChildAt(pool, cx, cy);
                              if (hit) {
                                onShapeSelect(hit.id);
                                return;
                              }
                              currentId = parent?.id ?? null;
                            }
                          }
                        }
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        const cx = shape.x + e.nativeEvent.offsetX;
                        const cy = shape.y + e.nativeEvent.offsetY;
                        const topNode = findNodeById(data.tree, shape.id);
                        if (!topNode) return;
                        const parentNode = selectedShapeId
                          ? (findNodeById([topNode], selectedShapeId) ?? topNode)
                          : topNode;
                        const child = topChildAt(parentNode.children, cx, cy);
                        if (child) onShapeSelect(child.id);
                      }}
                    />
                  ))}
                  {(() => {
                    const node = selectedShapeId ? findNodeById(data.tree, selectedShapeId) : null;
                    if (!node) return null;
                    return (
                      <div
                        className="pointer-events-none absolute"
                        style={{
                          left: node.x,
                          top: node.y,
                          width: node.width,
                          height: node.height,
                          zIndex: 2,
                          outline: '2px solid #2196f3',
                          outlineOffset: '1px',
                        }}
                      />
                    );
                  })()}
                </>
              )}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>
    </>
  );
};
