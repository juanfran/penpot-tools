import { useRef, useState, useEffect, useImperativeHandle, useCallback, useMemo } from 'react';
import { Debouncer } from '@tanstack/pacer';
import { getPageShapesFn } from '#/lib/server/penpot-api';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import {
  TransformWrapper,
  TransformComponent,
  Virtualize,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';

import { deepestAt, findNodeById, findParent, topChildAt } from './tree-utils';
import { loadTransform, saveTransform, type SavedTransform } from './transform-storage';
import { ZoomControls } from './zoom-controls';
import { ShapeNode } from './shape-node';
import { DistanceLines } from './distance-lines';
import { useInspectorPrefs } from '#/components/inspector-sidebar/prefs-store';

export type RenderHandle = {
  goToShape: (shapeId: string) => void;
};

const VISIBILITY_MARGIN = 500;

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
  const justPannedRef = useRef(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | undefined>(undefined);
  const unitFormat = useInspectorPrefs((s) => s.unitFormat);

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

  useEffect(() => {
    const isTextInput = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      if (isTextInput(e.target)) return;
      e.preventDefault();
      setIsSpacePressed(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      setIsSpacePressed(false);
    };
    const onBlur = () => setIsSpacePressed(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
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

      <div
        ref={containerRef}
        className={`relative h-full w-full bg-[#e8e9ea] contain-strict ${
          isSpacePressed ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
        onClick={() => {
          if (justPannedRef.current) {
            justPannedRef.current = false;
            return;
          }
          if (isSpacePressed) return;
          onShapeSelect?.(undefined);
        }}
      >
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
          onPanningStart={() => setIsPanning(true)}
          onPanningStop={() => {
            setIsPanning(false);
            justPannedRef.current = true;
          }}
          smooth={false}
          wheel={{ step: 0.1 }}
          panning={{ activationKeys: [' '] }}
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
              {onShapeSelect && !isSpacePressed && (
                <>
                  <div
                    className="pointer-events-auto absolute inset-0"
                    onClick={() => onShapeSelect(undefined)}
                    onMouseMove={() => {
                      if (hoveredShapeId !== undefined) setHoveredShapeId(undefined);
                    }}
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
                      onMouseMove={(e) => {
                        if (!selectedShapeId) {
                          if (hoveredShapeId !== undefined) setHoveredShapeId(undefined);
                          return;
                        }
                        const cx = shape.x + e.nativeEvent.offsetX;
                        const cy = shape.y + e.nativeEvent.offsetY;
                        const hit = deepestAt(data.tree, cx, cy);
                        const id = hit?.id ?? shape.id;
                        const next = id === selectedShapeId ? undefined : id;
                        if (next !== hoveredShapeId) setHoveredShapeId(next);
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
                </>
              )}
              {onShapeSelect &&
                (() => {
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
              {onShapeSelect &&
                !isSpacePressed &&
                selectedShapeId &&
                hoveredShapeId &&
                hoveredShapeId !== selectedShapeId &&
                (() => {
                  const selectedNode = findNodeById(data.tree, selectedShapeId);
                  const hoveredNode = findNodeById(data.tree, hoveredShapeId);
                  if (!selectedNode || !hoveredNode) return null;
                  return (
                    <>
                      <div
                        className="pointer-events-none absolute"
                        style={{
                          left: hoveredNode.x,
                          top: hoveredNode.y,
                          width: hoveredNode.width,
                          height: hoveredNode.height,
                          zIndex: 3,
                          outline: '2px solid #f59e0b',
                          outlineOffset: '1px',
                        }}
                      />
                      <DistanceLines
                        selected={selectedNode}
                        hovered={hoveredNode}
                        unit={unitFormat}
                      />
                    </>
                  );
                })()}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>
    </>
  );
};
