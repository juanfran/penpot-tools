import { useMemo, useRef } from 'react';
import { type ShapeTreeNode } from '#/lib/server/penpot-api';
import { type UnitFormat } from '#/components/inspector-sidebar/format-prefs';

import { DistanceLines } from './distance-lines';
import { deepestAt, findNodeById, findParent, topChildAt } from './tree-utils';

const HIT_ZONE_MARGIN = 1000;

export function ShapeHitZone({
  tree,
  selectedShapeId,
  hoveredShapeId,
  onShapeSelect,
  setHoveredShapeId,
}: {
  tree: ShapeTreeNode[];
  selectedShapeId?: string;
  hoveredShapeId?: string;
  onShapeSelect: (id: string | undefined) => void;
  setHoveredShapeId: (id: string | undefined) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const bounds = useMemo(() => {
    if (tree.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of tree) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    }
    return {
      x: minX - HIT_ZONE_MARGIN,
      y: minY - HIT_ZONE_MARGIN,
      width: maxX - minX + 2 * HIT_ZONE_MARGIN,
      height: maxY - minY + 2 * HIT_ZONE_MARGIN,
    };
  }, [tree]);

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={-1}
      aria-label="Canvas"
      className="pointer-events-auto absolute"
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        zIndex: 1,
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onShapeSelect(undefined);
      }}
      onMouseMove={(e) => {
        const cx = bounds.x + e.nativeEvent.offsetX;
        const cy = bounds.y + e.nativeEvent.offsetY;
        const top = topChildAt(tree, cx, cy);
        if (ref.current) ref.current.style.cursor = top ? 'pointer' : '';
        if (!selectedShapeId) {
          if (hoveredShapeId !== undefined) setHoveredShapeId(undefined);
          return;
        }
        const hit = deepestAt(tree, cx, cy);
        if (!hit) {
          if (hoveredShapeId !== undefined) setHoveredShapeId(undefined);
          return;
        }
        const next = hit.id === selectedShapeId ? undefined : hit.id;
        if (next !== hoveredShapeId) setHoveredShapeId(next);
      }}
      onClick={(e) => {
        e.stopPropagation();
        const cx = bounds.x + e.nativeEvent.offsetX;
        const cy = bounds.y + e.nativeEvent.offsetY;
        const topShape = topChildAt(tree, cx, cy);
        if (!topShape) {
          onShapeSelect(undefined);
          return;
        }
        if (e.ctrlKey) {
          const hit = deepestAt(tree, cx, cy);
          onShapeSelect(hit?.id ?? topShape.id);
          return;
        }
        const alreadyInside = selectedShapeId
          ? findNodeById([topShape], selectedShapeId) !== null
          : false;
        if (!alreadyInside) {
          onShapeSelect(topShape.id);
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
        const cx = bounds.x + e.nativeEvent.offsetX;
        const cy = bounds.y + e.nativeEvent.offsetY;
        const topShape = topChildAt(tree, cx, cy);
        if (!topShape) return;
        const parentNode = selectedShapeId
          ? (findNodeById([topShape], selectedShapeId) ?? topShape)
          : topShape;
        const child = topChildAt(parentNode.children, cx, cy);
        if (child) onShapeSelect(child.id);
      }}
    />
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
