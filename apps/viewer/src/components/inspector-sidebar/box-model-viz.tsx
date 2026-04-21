import type { BoxModel, Margins } from './box-model';

function fmt(n: number): string {
  return n === 0 ? '-' : String(Math.round(n * 10) / 10);
}

function fmtMargin(n: number | null): string {
  if (n === null) return '-';
  return String(Math.round(n * 10) / 10);
}

export function BoxModelViz({ model, margins }: { model: BoxModel; margins: Margins }) {
  const [bt, br, bb, bl] = model.border;
  const [pt, pr, pb, pl] = model.padding;

  const lbl = 'absolute text-[10px] font-mono leading-none select-none';

  return (
    <div className="px-4 pt-3 pb-4">
      <p className="mb-2 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
        Box model
      </p>
      {/* margin — peach */}
      <div className="relative rounded" style={{ background: '#f7cb99', padding: '18px' }}>
        <span className="absolute top-0.5 left-1 text-[9px] font-medium text-orange-800 opacity-70 select-none">
          margin
        </span>
        <span className={`${lbl} top-1 left-1/2 -translate-x-1/2 text-orange-900`}>
          {fmtMargin(margins.top)}
        </span>
        <span className={`${lbl} bottom-1 left-1/2 -translate-x-1/2 text-orange-900`}>
          {fmtMargin(margins.bottom)}
        </span>
        <span className={`${lbl} top-1/2 left-1 -translate-y-1/2 text-orange-900`}>
          {fmtMargin(margins.left)}
        </span>
        <span className={`${lbl} top-1/2 right-1 -translate-y-1/2 text-orange-900`}>
          {fmtMargin(margins.right)}
        </span>
        {/* border — yellow */}
        <div className="relative rounded" style={{ background: '#fce28a', padding: '18px' }}>
          <span className="absolute top-0.5 left-1 text-[9px] font-medium text-yellow-700 opacity-70 select-none">
            border
          </span>
          <span className={`${lbl} top-1 left-1/2 -translate-x-1/2 text-yellow-900`}>
            {fmt(bt)}
          </span>
          <span className={`${lbl} bottom-1 left-1/2 -translate-x-1/2 text-yellow-900`}>
            {fmt(bb)}
          </span>
          <span className={`${lbl} top-1/2 left-1 -translate-y-1/2 text-yellow-900`}>
            {fmt(bl)}
          </span>
          <span className={`${lbl} top-1/2 right-1 -translate-y-1/2 text-yellow-900`}>
            {fmt(br)}
          </span>
          {/* padding — green */}
          <div className="relative rounded" style={{ background: '#b5d99c', padding: '18px' }}>
            <span className="absolute top-0.5 left-1 text-[9px] font-medium text-green-800 opacity-70 select-none">
              padding
            </span>
            <span className={`${lbl} top-1 left-1/2 -translate-x-1/2 text-green-900`}>
              {fmt(pt)}
            </span>
            <span className={`${lbl} bottom-1 left-1/2 -translate-x-1/2 text-green-900`}>
              {fmt(pb)}
            </span>
            <span className={`${lbl} top-1/2 left-1 -translate-y-1/2 text-green-900`}>
              {fmt(pl)}
            </span>
            <span className={`${lbl} top-1/2 right-1 -translate-y-1/2 text-green-900`}>
              {fmt(pr)}
            </span>
            {/* content — blue */}
            <div
              className="flex items-center justify-center rounded font-mono text-xs font-semibold text-blue-900"
              style={{ background: '#9dc4e8', padding: '10px 4px' }}
            >
              {fmt(model.width)} × {fmt(model.height)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
