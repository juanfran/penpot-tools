import { type Asset } from './assets';
import { AssetDownloadDialog } from './asset-download-dialog';

export function AssetItem({ asset }: { asset: Asset }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50 p-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-white">
        {asset.kind === 'image' && asset.src ? (
          <img src={asset.src} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center [&>svg]:max-h-full [&>svg]:max-w-full"
            // react-doctor-disable-next-line react/no-danger
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
      <AssetDownloadDialog asset={asset} />
    </div>
  );
}
