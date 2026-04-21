import type { CSSProperties } from 'react';
import type { ShapeTreeNode } from '#/lib/server/penpot-api';
import { transformValue, type UnitFormat } from '#/components/inspector-sidebar/format-prefs';
import { computeDistanceLines, type GapLineSpec } from './distance-lines-compute';

const COLOR = '#f59e0b';
const LINE_INSET = 3;

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
  const lines = computeDistanceLines(selected, hovered);
  if (lines.length === 0) return null;
  return (
    <>
      {lines.map(({ key, ...rest }) => (
        <GapLine key={key} {...rest} unit={unit} />
      ))}
    </>
  );
}

function GapLine({
  orientation,
  start,
  end,
  cross,
  unit,
}: Omit<GapLineSpec, 'key'> & { unit: UnitFormat }) {
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
