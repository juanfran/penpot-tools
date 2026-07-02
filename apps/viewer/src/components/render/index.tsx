import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  useCallback,
  useMemo,
  useReducer,
} from 'react';
import { Debouncer } from '@tanstack/pacer';
import {
  getFileTokenSetsFn,
  getPageShapesFn,
  type FileTokenSet,
} from '#/lib/server/penpot-api';
import { queryOptions, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import {
  TransformWrapper,
  TransformComponent,
  Virtualize,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';
import { Palette } from 'lucide-react';

import { findFirstBoard, findNodeById } from './tree-utils';
import { loadTransform, saveTransform, type SavedTransform } from './transform-storage';
import { ZoomControls } from './zoom-controls';
import { ShapeNode } from './shape-node';
import { SelectionHighlights, ShapeHitZone } from './shape-overlays';
import { useInspectorPrefs } from '#/components/inspector-sidebar/prefs-store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select';

export type RenderHandle = {
  goToShape: (shapeId: string) => void;
};

const VISIBILITY_MARGIN = 500;
const CURRENT_TOKEN_SET_ID = '__current__';

export const getPageShapesOptions = (fileId: string, pageId: string) =>
  queryOptions({
    queryKey: ['get-page-shapes', fileId, pageId],
    queryFn: () => getPageShapesFn({ data: { fileId, pageId } }),
  });

export const getFileTokenSetsOptions = (fileId: string) =>
  queryOptions({
    queryKey: ['get-file-token-sets', fileId],
    queryFn: async () => {
      try {
        return await getFileTokenSetsFn({ data: { fileId } });
      } catch (err) {
        console.warn('Could not load Penpot token sets', err);
        return [];
      }
    },
    staleTime: 60_000,
  });

function tokenSetStorageKey(fileId: string): string {
  return `penpot-tools:token-set:${fileId}`;
}

function loadSelectedTokenSet(fileId: string): string {
  if (typeof window === 'undefined') return CURRENT_TOKEN_SET_ID;
  return window.localStorage.getItem(tokenSetStorageKey(fileId)) ?? CURRENT_TOKEN_SET_ID;
}

function defaultTokenSetId(tokenSets: FileTokenSet[]): string {
  return (
    tokenSets.find((set) => set.active)?.id ??
    tokenSets[0]?.id ??
    CURRENT_TOKEN_SET_ID
  );
}

function saveSelectedTokenSet(fileId: string, value: string): void {
  if (typeof window === 'undefined') return;
  const key = tokenSetStorageKey(fileId);
  if (value === CURRENT_TOKEN_SET_ID) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, value);
  }
}

function TokenSetPicker({
  value,
  tokenSets,
  onChange,
}: {
  value: string;
  tokenSets: FileTokenSet[];
  onChange: (value: string) => void;
}) {
  const handleValueChange = (next: string | null) => {
    if (next) onChange(next);
  };
  const hasTokenSets = tokenSets.length > 0;
  const selectedLabel =
    tokenSets.find((set) => set.id === value)?.name ??
    (hasTokenSets ? tokenSets[0]!.name : 'Current');

  return (
    <div
      className="absolute top-4 right-4 z-50"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger className="h-8 max-w-64 border-white/10 bg-black/60 px-2.5 text-xs text-white shadow-xl backdrop-blur-sm hover:bg-black/70">
          <Palette className="size-3.5 text-white/70" />
          <SelectValue>{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false} className="min-w-52">
          {!hasTokenSets && <SelectItem value={CURRENT_TOKEN_SET_ID}>Current</SelectItem>}
          {!hasTokenSets ? (
            <SelectItem value="__none__" disabled>
              No token sets found
            </SelectItem>
          ) : (
            tokenSets.map((set) => (
              <SelectItem key={set.id} value={set.id}>
                <span className="truncate">{set.name}</span>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

export const Render = ({
  pageId,
  fileId,
  selectedShapeId,
  onShapeSelect,
  initialShapeId,
  ref,
}: {
  pageId: string;
  fileId: string;
  selectedShapeId?: string;
  onShapeSelect?: (id: string | undefined) => void;
  initialShapeId?: string;
  ref?: React.Ref<RenderHandle>;
}) => {
  const { data } = useSuspenseQuery(getPageShapesOptions(fileId, pageId));
  const { data: tokenSets = [] } = useQuery(getFileTokenSetsOptions(fileId));

  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const justPannedRef = useRef(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [selectedTokenSetId, setSelectedTokenSetId] = useState(() => loadSelectedTokenSet(fileId));
  const [isSpacePressed, dispatchSpace] = useReducer(
    (_state: boolean, next: boolean) => next,
    false,
  );
  const [isPanning, setIsPanning] = useState(false);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | undefined>(undefined);
  const unitFormat = useInspectorPrefs((s) => s.unitFormat);
  const selectedTokenSet = useMemo(
    () => tokenSets.find((set) => set.id === selectedTokenSetId),
    [selectedTokenSetId, tokenSets],
  );

  useEffect(() => {
    setSelectedTokenSetId(loadSelectedTokenSet(fileId));
  }, [fileId]);

  useEffect(() => {
    if (tokenSets.length === 0) return;
    if (!tokenSets.some((set) => set.id === selectedTokenSetId)) {
      const next = defaultTokenSetId(tokenSets);
      setSelectedTokenSetId(next);
      saveSelectedTokenSet(fileId, next);
    }
  }, [fileId, selectedTokenSetId, tokenSets]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setContainerSize({ width: rect.width, height: rect.height });
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
      dispatchSpace(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      dispatchSpace(false);
    };
    const onBlur = () => dispatchSpace(false);
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

  const initialTransform = useMemo<SavedTransform | null | undefined>(() => {
    if (!containerSize.width || !containerSize.height) return undefined;
    const W = containerSize.width;
    const H = containerSize.height;
    const fitTransform = (node: { x: number; y: number; width: number; height: number }) => {
      const margin = 0.9;
      const scaleFit = Math.min(W / node.width, H / node.height) * margin;
      const scale = Math.min(Math.max(scaleFit, 0.05), 2);
      const cx = node.x + node.width / 2;
      const cy = node.y + node.height / 2;
      return {
        positionX: W / 2 - scale * cx,
        positionY: H / 2 - scale * cy,
        scale,
      };
    };
    if (initialShapeId) {
      const node = findNodeById(data.tree, initialShapeId);
      if (node && node.width && node.height) return fitTransform(node);
    }
    const saved = loadTransform(fileId, pageId);
    if (saved) return saved;
    const firstBoard = findFirstBoard(data.tree);
    if (firstBoard && firstBoard.width && firstBoard.height) return fitTransform(firstBoard);
    return null;
  }, [containerSize.width, containerSize.height, data.tree, fileId, pageId, initialShapeId]);

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
      {data.fontsCss && <style>{data.fontsCss}</style>}
      {data.tokensCss && <style>{data.tokensCss}</style>}
      {selectedTokenSet?.css && <style>{selectedTokenSet.css}</style>}

      <div
        ref={containerRef}
        role="application"
        aria-label="Design canvas"
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
        onKeyDown={(e) => {
          if (e.key === 'Escape') onShapeSelect?.(undefined);
        }}
      >
        <TokenSetPicker
          value={selectedTokenSetId}
          tokenSets={tokenSets}
          onChange={(value) => {
            setSelectedTokenSetId(value);
            saveSelectedTokenSet(fileId, value);
          }}
        />
        {initialTransform !== undefined && (
          <TransformWrapper
            key={pageId}
            ref={transformRef}
            minScale={0.1}
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
                  <ShapeHitZone
                    tree={data.tree}
                    selectedShapeId={selectedShapeId}
                    hoveredShapeId={hoveredShapeId}
                    onShapeSelect={onShapeSelect}
                    setHoveredShapeId={setHoveredShapeId}
                  />
                )}
                {onShapeSelect && (
                  <SelectionHighlights
                    tree={data.tree}
                    selectedShapeId={selectedShapeId}
                    hoveredShapeId={hoveredShapeId}
                    unitFormat={unitFormat}
                    showHover={!isSpacePressed}
                  />
                )}
              </div>
            </TransformComponent>
          </TransformWrapper>
        )}
      </div>
    </>
  );
};
