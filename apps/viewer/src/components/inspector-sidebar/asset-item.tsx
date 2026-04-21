import { Download } from 'lucide-react';
import { useState } from 'react';

import { type Asset, downloadImageAsset, downloadSvgAsset } from './assets';

export function AssetItem({ asset }: { asset: Asset }) {
  const [busy, setBusy] = useState(false);

  const onDownload = async () => {
    setBusy(true);
    try {
      if (asset.kind === 'image' && asset.src) {
        await downloadImageAsset(asset.src, asset.name);
      } else if (asset.kind === 'svg' && asset.svg) {
        downloadSvgAsset(asset.svg, asset.name);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50 p-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-white">
        {asset.kind === 'image' && asset.src ? (
          <img src={asset.src} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center [&>svg]:max-h-full [&>svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: asset.svg ?? '' }}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-800" title={asset.name}>
          {asset.name}
        </p>
        <p className="text-[10px] tracking-wider text-gray-400 uppercase">
          {asset.kind === 'image' ? 'Image' : 'SVG'}
        </p>
      </div>
      <button
        onClick={onDownload}
        disabled={busy}
        className="flex items-center rounded px-1.5 py-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
        title="Download"
      >
        <Download size={12} />
      </button>
    </div>
  );
}
