import { type ShapeTreeNode } from '#/lib/server/penpot-api';
import { getPageShapesOptions } from '#/components/render';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronRight,
  Square,
  Circle,
  Type,
  Image,
  Layers,
  Frame,
  Minus,
  Star,
  GitMerge,
} from 'lucide-react';

function shapeIcon(type: string) {
  const cls = 'shrink-0 text-gray-400';
  switch (type) {
    case 'frame':
      return <Frame size={12} className={cls} />;
    case 'group':
      return <Layers size={12} className={cls} />;
    case 'rect':
      return <Square size={12} className={cls} />;
    case 'circle':
      return <Circle size={12} className={cls} />;
    case 'text':
      return <Type size={12} className={cls} />;
    case 'image':
      return <Image size={12} className={cls} />;
    case 'path':
      return <Minus size={12} className={cls} />;
    case 'bool':
      return <GitMerge size={12} className={cls} />;
    case 'svg-raw':
      return <Star size={12} className={cls} />;
    default:
      return <Square size={12} className={cls} />;
  }
}

function findAncestorIds(
  nodes: ShapeTreeNode[],
  targetId: string,
  path: string[] = [],
): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return path;
    const found = findAncestorIds(node.children, targetId, [...path, node.id]);
    if (found) return found;
  }
  return null;
}

function ShapeTreeItem({
  node,
  depth,
  selectedShapeId,
  ancestorIds,
  onShapeSelect,
}: {
  node: ShapeTreeNode;
  depth: number;
  selectedShapeId?: string;
  ancestorIds: Set<string>;
  onShapeSelect: (id: string) => void;
}) {
  const isSelected = node.id === selectedShapeId;
  const isAncestor = ancestorIds.has(node.id);
  const [open, setOpen] = useState(false);
  const hasChildren = node.children.length > 0;
  const rowRef = useRef<HTMLDivElement>(null);

  const isOpen = open || isAncestor;

  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  return (
    <li>
      <div
        ref={rowRef}
        className={`flex w-full cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-gray-100 ${isSelected ? 'bg-blue-100 text-blue-900' : ''}`}
        style={{ paddingLeft: `${4 + depth * 12}px` }}
        onClick={() => onShapeSelect(node.id)}
      >
        <span
          className="flex w-3 shrink-0 items-center justify-center"
          onClick={(e) => {
            if (!hasChildren) return;
            e.stopPropagation();
            setOpen((o) => !o);
          }}
        >
          {hasChildren && (
            <ChevronRight
              size={10}
              className={`text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
            />
          )}
        </span>
        {shapeIcon(node.type)}
        <span className="truncate text-sm text-gray-700">{node.name}</span>
      </div>
      {isOpen && hasChildren && (
        <ul>
          {node.children.map((child) => (
            <ShapeTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedShapeId={selectedShapeId}
              ancestorIds={ancestorIds}
              onShapeSelect={onShapeSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function ShapeTree({
  fileId,
  pageId,
  selectedShapeId,
  onShapeSelect,
}: {
  fileId: string;
  pageId: string;
  selectedShapeId?: string;
  onShapeSelect: (id: string) => void;
}) {
  const { data } = useSuspenseQuery(getPageShapesOptions(fileId, pageId));

  const ancestorIds = useMemo(() => {
    if (!selectedShapeId) return new Set<string>();
    return new Set(findAncestorIds(data.tree, selectedShapeId) ?? []);
  }, [selectedShapeId, data.tree]);

  return (
    <ul className="overflow-auto px-1">
      {data.tree.map((node) => (
        <ShapeTreeItem
          key={node.id}
          node={node}
          depth={0}
          selectedShapeId={selectedShapeId}
          ancestorIds={ancestorIds}
          onShapeSelect={onShapeSelect}
        />
      ))}
    </ul>
  );
}

interface PagesSidebarProps {
  fileId: string;
  pageId: string;
  fileSummary: {
    data: {
      pages: string[];
      pagesIndex: Record<string, { id: string; name: string }>;
    };
  };
  teamId?: string;
  selectedShapeId?: string;
  onShapeSelect: (id: string) => void;
}

export function PagesSidebar({
  fileId,
  pageId,
  fileSummary,
  teamId,
  selectedShapeId,
  onShapeSelect,
}: PagesSidebarProps) {
  return (
    <aside className="flex w-84 flex-col border-r border-gray-200">
      <div className="flex h-1/2 flex-col gap-1 overflow-auto border-b border-gray-200 p-3">
        {fileSummary.data.pages.map((pid) => {
          const page = fileSummary.data.pagesIndex[pid];
          return (
            <Link
              key={pid}
              to="/workspace/$fileId/$pageId"
              params={{ fileId, pageId: pid }}
              search={{ teamId: teamId ?? undefined }}
              className="rounded px-2 py-1 text-sm hover:bg-gray-100"
              activeProps={{ className: 'rounded px-2 py-1 text-sm bg-gray-200 font-medium' }}
            >
              {page?.name ?? pid}
            </Link>
          );
        })}
      </div>
      <div className="flex h-1/2 flex-col">
        <p className="px-3 py-2 text-xs font-medium tracking-wide text-gray-500 uppercase">
          Layers
        </p>
        <div className="min-h-0 flex-1 overflow-auto">
          <ShapeTree
            fileId={fileId}
            pageId={pageId}
            selectedShapeId={selectedShapeId}
            onShapeSelect={onShapeSelect}
          />
        </div>
      </div>
    </aside>
  );
}
