import type { CSSProperties, ReactNode } from 'react';
import type { ShapeTreeNode } from '#/lib/server/penpot-api';
import { transformValue, type UnitFormat } from '#/components/inspector-sidebar/format-prefs';

const COLOR = '#f59e0b';
const EPS = 0.5;

function formatDistance(px: number, unit: UnitFormat): string {
  const rounded = Math.round(px * 10) / 10;
  return transformValue(`${rounded}px`, 'hex', unit);
}

export function DistanceLines({
  selected,
  hovered,
  unit,
}: {
  selected: ShapeTreeNode;
  hovered: ShapeTreeNode;
  unit: UnitFormat;
}) {
  const a = selected;
  const b = hovered;
  const aRight = a.x + a.width;
  const aBottom = a.y + a.height;
  const bRight = b.x + b.width;
  const bBottom = b.y + b.height;

  const xDisjoint = aRight < b.x - EPS || bRight < a.x - EPS;
  const yDisjoint = aBottom < b.y - EPS || bBottom < a.y - EPS;

  const elements: ReactNode[] = [];

  if (xDisjoint || yDisjoint) {
    // Sibling-style relationship: show only gap lines on the separated axes.
    if (xDisjoint) {
      const hStart = aRight < b.x ? aRight : bRight;
      const hEnd = aRight < b.x ? b.x : a.x;
      const hLineY = (a.y + a.height / 2 + b.y + b.height / 2) / 2;
      elements.push(
        <GapLine key="hgap" orientation="h" start={hStart} end={hEnd} cross={hLineY} unit={unit} />,
      );
    }
    if (yDisjoint) {
      const vStart = aBottom < b.y ? aBottom : bBottom;
      const vEnd = aBottom < b.y ? b.y : a.y;
      const vLineX = (a.x + a.width / 2 + b.x + b.width / 2) / 2;
      elements.push(
        <GapLine key="vgap" orientation="v" start={vStart} end={vEnd} cross={vLineX} unit={unit} />,
      );
    }
  } else {
    // Both axes overlap — parent/child or intersecting shapes.
    // Show the four edge-to-edge inset distances.
    const yCross = (Math.max(a.y, b.y) + Math.min(aBottom, bBottom)) / 2;
    const xCross = (Math.max(a.x, b.x) + Math.min(aRight, bRight)) / 2;
    if (Math.abs(a.x - b.x) > EPS) {
      elements.push(
        <GapLine
          key="hleft"
          orientation="h"
          start={Math.min(a.x, b.x)}
          end={Math.max(a.x, b.x)}
          cross={yCross}
          unit={unit}
        />,
      );
    }
    if (Math.abs(aRight - bRight) > EPS) {
      elements.push(
        <GapLine
          key="hright"
          orientation="h"
          start={Math.min(aRight, bRight)}
          end={Math.max(aRight, bRight)}
          cross={yCross}
          unit={unit}
        />,
      );
    }
    if (Math.abs(a.y - b.y) > EPS) {
      elements.push(
        <GapLine
          key="vtop"
          orientation="v"
          start={Math.min(a.y, b.y)}
          end={Math.max(a.y, b.y)}
          cross={xCross}
          unit={unit}
        />,
      );
    }
    if (Math.abs(aBottom - bBottom) > EPS) {
      elements.push(
        <GapLine
          key="vbot"
          orientation="v"
          start={Math.min(aBottom, bBottom)}
          end={Math.max(aBottom, bBottom)}
          cross={xCross}
          unit={unit}
        />,
      );
    }
  }

  if (elements.length === 0) return null;
  return <>{elements}</>;
}

const LINE_INSET = 3;

function GapLine({
  orientation,
  start,
  end,
  cross,
  unit,
}: {
  orientation: 'h' | 'v';
  start: number;
  end: number;
  cross: number;
  unit: UnitFormat;
}) {
  const label = formatDistance(end - start, unit);
  const inset = Math.max(0, Math.min(LINE_INSET, (end - start - 1) / 2));
  const lineStart = start + inset;
  const lineEnd = end - inset;
  const labelStyle: CSSProperties = {
    background: COLOR,
    color: 'white',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '11px',
    fontFamily: 'monospace',
    whiteSpace: 'nowrap',
    display: 'inline-block',
  };

  if (orientation === 'h') {
    return (
      <>
        <div
          className="pointer-events-none absolute"
          style={{
            left: lineStart,
            top: cross,
            width: lineEnd - lineStart,
            height: 0,
            borderTop: `1px dashed ${COLOR}`,
            zIndex: 4,
          }}
        />
        <div
          className="pointer-events-none absolute"
          style={{
            left: (start + end) / 2,
            top: cross,
            transform: 'translate(-50%, calc(-100% - 2px))',
            zIndex: 5,
          }}
        >
          <span style={labelStyle}>{label}</span>
        </div>
      </>
    );
  }

  return (
    <>
      <div
        className="pointer-events-none absolute"
        style={{
          left: cross,
          top: lineStart,
          width: 0,
          height: lineEnd - lineStart,
          borderLeft: `1px dashed ${COLOR}`,
          zIndex: 4,
        }}
      />
      <div
        className="pointer-events-none absolute"
        style={{
          left: cross,
          top: (start + end) / 2,
          transform: 'translate(4px, -50%)',
          zIndex: 5,
        }}
      >
        <span style={labelStyle}>{label}</span>
      </div>
    </>
  );
}
