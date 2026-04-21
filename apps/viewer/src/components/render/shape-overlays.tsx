import { type ShapeTreeNode } from '#/lib/server/penpot-api';
import { type UnitFormat } from '#/components/inspector-sidebar/format-prefs';

import { DistanceLines } from './distance-lines';
import { deepestAt, findNodeById, findParent, topChildAt } from './tree-utils';

type HitShape = { id: string; x: number; y: number; width: number; height: number };

export function ShapeHitZones({
  shapes,
  tree,
  selectedShapeId,
  hoveredShapeId,
  onShapeSelect,
  setHoveredShapeId,
}: {
  shapes: HitShape[];
  tree: ShapeTreeNode[];
  selectedShapeId?: string;
  hoveredShapeId?: string;
  onShapeSelect: (id: string | undefined) => void;
  setHoveredShapeId: (id: string | undefined) => void;
}) {
  return (
    <>
      <div
        role="button"
        tabIndex={-1}
        aria-label="Deselect shape"
        className="pointer-events-auto absolute inset-0"
        onClick={() => onShapeSelect(undefined)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onShapeSelect(undefined);
        }}
        onMouseMove={() => {
          if (hoveredShapeId !== undefined) setHoveredShapeId(undefined);
        }}
      />
      {shapes.map((shape) => (
        <div
          key={`sel-${shape.id}`}
          role="button"
          tabIndex={-1}
          aria-label={`Select shape ${shape.id}`}
          className="pointer-events-auto absolute cursor-pointer"
          style={{
            left: shape.x,
            top: shape.y,
            width: shape.width,
            height: shape.height,
            zIndex: 1,
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onShapeSelect(shape.id);
          }}
          onMouseMove={(e) => {
            if (!selectedShapeId) {
              if (hoveredShapeId !== undefined) setHoveredShapeId(undefined);
              return;
            }
            const cx = shape.x + e.nativeEvent.offsetX;
            const cy = shape.y + e.nativeEvent.offsetY;
            const hit = deepestAt(tree, cx, cy);
            const id = hit?.id ?? shape.id;
            const next = id === selectedShapeId ? undefined : id;
            if (next !== hoveredShapeId) setHoveredShapeId(next);
          }}
          onClick={(e) => {
            e.stopPropagation();
            const cx = shape.x + e.nativeEvent.offsetX;
            const cy = shape.y + e.nativeEvent.offsetY;
            if (e.ctrlKey) {
              const hit = deepestAt(tree, cx, cy);
              onShapeSelect(hit?.id ?? shape.id);
              return;
            }
            const topNode = findNodeById(tree, shape.id);
            const alreadyInside =
              topNode && selectedShapeId
                ? findNodeById([topNode], selectedShapeId) !== null
                : false;
            if (!alreadyInside) {
              onShapeSelect(shape.id);
              return;
            }
            if (!selectedShapeId) return;
            let currentId: string | null = selectedShapeId;
            while (currentId) {
              const parent = findParent(tree, currentId);
              const pool = parent ? parent.children : tree;
              const hit = topChildAt(pool, cx, cy);
              if (hit) {
                onShapeSelect(hit.id);
                return;
              }
              currentId = parent?.id ?? null;
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            const cx = shape.x + e.nativeEvent.offsetX;
            const cy = shape.y + e.nativeEvent.offsetY;
            const topNode = findNodeById(tree, shape.id);
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
  );
}

export function SelectionHighlights({
  tree,
  selectedShapeId,
  hoveredShapeId,
  unitFormat,
  showHover,
}: {
  tree: ShapeTreeNode[];
  selectedShapeId?: string;
  hoveredShapeId?: string;
  unitFormat: UnitFormat;
  showHover: boolean;
}) {
  const selectedNode = selectedShapeId ? findNodeById(tree, selectedShapeId) : null;
  const hoveredNode =
    showHover && hoveredShapeId && hoveredShapeId !== selectedShapeId
      ? findNodeById(tree, hoveredShapeId)
      : null;

  return (
    <>
      {selectedNode && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: selectedNode.x,
            top: selectedNode.y,
            width: selectedNode.width,
            height: selectedNode.height,
            zIndex: 2,
            outline: '2px solid #2196f3',
            outlineOffset: '1px',
          }}
        />
      )}
      {selectedNode && hoveredNode && (
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
          <DistanceLines selected={selectedNode} hovered={hoveredNode} unit={unitFormat} />
        </>
      )}
    </>
  );
}
