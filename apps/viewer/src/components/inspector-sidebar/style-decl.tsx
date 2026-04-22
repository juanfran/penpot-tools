import { type ReactNode } from 'react';

import { COLOR_REGEX } from './format-prefs';

function renderValue(value: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let i = 0;
  for (const m of value.matchAll(COLOR_REGEX)) {
    const start = m.index ?? 0;
    if (start > lastIndex) parts.push(value.slice(lastIndex, start));
    parts.push(
      <span
        key={`sw-${i++}`}
        aria-hidden="true"
        className="mr-1 inline-block h-3 w-3 rounded-sm border border-gray-300 align-[-2px] select-none"
        style={{ backgroundColor: m[0] }}
      />,
    );
    parts.push(m[0]);
    lastIndex = start + m[0].length;
  }
  if (lastIndex < value.length) parts.push(value.slice(lastIndex));
  return parts;
}

export function StyleDecl({ prop, value }: { prop: string; value: string }) {
  return (
    <div className="flex min-w-0 gap-0.5 py-0.5">
      <span className="shrink-0 text-violet-600">{prop}</span>
      <span className="text-gray-400">:</span>
      <span className="min-w-0 break-all text-amber-700">{renderValue(value)}</span>
      <span className="shrink-0 text-gray-400">;</span>
    </div>
  );
}
