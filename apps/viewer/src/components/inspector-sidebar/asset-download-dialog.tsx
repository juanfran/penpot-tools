import { Button } from '#/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog';
import { Download } from 'lucide-react';
import { useState } from 'react';

import { type AssetDownloadMode, type ImageOutputFormat } from '#/lib/asset-download-types';
import { prepareAssetDownloadFn } from '#/lib/server/asset-download';
import { type Asset, downloadPreparedAsset } from './assets';
import { Segmented } from './segmented';

const IMAGE_FORMATS: Array<{ label: string; value: ImageOutputFormat }> = [
  { label: 'WebP', value: 'image/webp' },
  { label: 'JPEG', value: 'image/jpeg' },
  { label: 'PNG', value: 'image/png' },
];

export function AssetDownloadDialog({ asset }: { asset: Asset }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AssetDownloadMode>('original');
  const [format, setFormat] = useState<ImageOutputFormat>('image/webp');
  const [quality, setQuality] = useState(82);
  const [resize, setResize] = useState(false);
  const [maxSide, setMaxSide] = useState(2048);
  const [multipass, setMultipass] = useState(true);
  const [floatPrecision, setFloatPrecision] = useState(3);
  const [cleanupIds, setCleanupIds] = useState(true);
  const [removeDimensions, setRemoveDimensions] = useState(false);
  const [removeMetadata, setRemoveMetadata] = useState(true);
  const [sortAttrs, setSortAttrs] = useState(true);

  const isSvg = asset.kind === 'svg';

  const handleDownload = async () => {
    setBusy(true);
    setError(null);
    try {
      if (asset.kind === 'image' && asset.src) {
        const result = await prepareAssetDownloadFn({
          data:
            mode === 'optimized'
              ? {
                  kind: 'image',
                  src: asset.src,
                  baseName: asset.name,
                  mode,
                  format,
                  quality,
                  maxSide: resize ? maxSide : null,
                }
              : {
                  kind: 'image',
                  src: asset.src,
                  baseName: asset.name,
                  mode,
                },
        });
        downloadPreparedAsset(result);
      } else if (asset.kind === 'svg' && asset.svg) {
        const result = await prepareAssetDownloadFn({
          data:
            mode === 'optimized'
              ? {
                  kind: 'svg',
                  markup: asset.svg,
                  baseName: asset.name,
                  mode,
                  multipass,
                  floatPrecision,
                  cleanupIds,
                  removeDimensions,
                  removeMetadata,
                  sortAttrs,
                }
              : {
                  kind: 'svg',
                  markup: asset.svg,
                  baseName: asset.name,
                  mode,
                },
        });
        downloadPreparedAsset(result);
      }
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download asset.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex items-center rounded px-1.5 py-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
            title="Download"
          />
        }
      >
        <Download size={12} />
      </DialogTrigger>
      <DialogContent className="!max-w-md">
        <DialogHeader>
          <DialogTitle>Download asset</DialogTitle>
          <DialogDescription>
            Choose the original file or generate an optimized copy before downloading.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="truncate text-xs font-medium text-gray-800" title={asset.name}>
            {asset.name}
          </p>
          <p className="text-[10px] tracking-wider text-gray-400 uppercase">
            {isSvg ? 'SVG' : 'Image'}
          </p>
        </div>

        <Segmented
          label="Mode"
          value={mode}
          onChange={setMode}
          options={['original', 'optimized']}
        />

        {mode === 'optimized' &&
          (isSvg ? (
            <SvgOptions
              multipass={multipass}
              onMultipassChange={setMultipass}
              floatPrecision={floatPrecision}
              onFloatPrecisionChange={setFloatPrecision}
              cleanupIds={cleanupIds}
              onCleanupIdsChange={setCleanupIds}
              removeDimensions={removeDimensions}
              onRemoveDimensionsChange={setRemoveDimensions}
              removeMetadata={removeMetadata}
              onRemoveMetadataChange={setRemoveMetadata}
              sortAttrs={sortAttrs}
              onSortAttrsChange={setSortAttrs}
            />
          ) : (
            <ImageOptions
              format={format}
              onFormatChange={setFormat}
              quality={quality}
              onQualityChange={setQuality}
              resize={resize}
              onResizeChange={setResize}
              maxSide={maxSide}
              onMaxSideChange={setMaxSide}
            />
          ))}

        {error && <p className="text-destructive text-xs">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={handleDownload} disabled={busy}>
            <Download />
            {busy ? 'Preparing...' : 'Download'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImageOptions({
  format,
  onFormatChange,
  quality,
  onQualityChange,
  resize,
  onResizeChange,
  maxSide,
  onMaxSideChange,
}: {
  format: ImageOutputFormat;
  onFormatChange: (value: ImageOutputFormat) => void;
  quality: number;
  onQualityChange: (value: number) => void;
  resize: boolean;
  onResizeChange: (value: boolean) => void;
  maxSide: number;
  onMaxSideChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] tracking-wider text-gray-400 uppercase">Format</span>
        <div className="inline-flex overflow-hidden rounded border border-gray-200 bg-gray-50">
          {IMAGE_FORMATS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onFormatChange(item.value)}
              className={
                format === item.value
                  ? 'bg-white px-2 py-0.5 font-mono text-[10px] text-gray-800 shadow-sm'
                  : 'px-2 py-0.5 font-mono text-[10px] text-gray-400 hover:text-gray-600'
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <label className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] tracking-wider text-gray-400 uppercase">Quality</span>
          <span className="font-mono text-[10px] text-gray-500">{quality}%</span>
        </div>
        <input
          type="range"
          min={30}
          max={100}
          value={quality}
          onChange={(e) => onQualityChange(Number(e.target.value))}
          className="w-full"
        />
      </label>

      <div className="grid grid-cols-[1fr_auto] items-center gap-2">
        <Checkbox checked={resize} onChange={onResizeChange} label="Max size" />
        <input
          type="number"
          min={64}
          step={64}
          value={maxSide}
          disabled={!resize}
          onChange={(e) => onMaxSideChange(Math.max(64, Number(e.target.value) || 64))}
          className="h-7 w-20 rounded border border-gray-200 bg-white px-2 font-mono text-xs text-gray-700 disabled:bg-gray-50 disabled:text-gray-300"
        />
      </div>

      {format === 'image/jpeg' && (
        <p className="text-xs text-gray-400">JPEG flattens transparency onto a white background.</p>
      )}
    </div>
  );
}

function SvgOptions({
  multipass,
  onMultipassChange,
  floatPrecision,
  onFloatPrecisionChange,
  cleanupIds,
  onCleanupIdsChange,
  removeDimensions,
  onRemoveDimensionsChange,
  removeMetadata,
  onRemoveMetadataChange,
  sortAttrs,
  onSortAttrsChange,
}: {
  multipass: boolean;
  onMultipassChange: (value: boolean) => void;
  floatPrecision: number;
  onFloatPrecisionChange: (value: number) => void;
  cleanupIds: boolean;
  onCleanupIdsChange: (value: boolean) => void;
  removeDimensions: boolean;
  onRemoveDimensionsChange: (value: boolean) => void;
  removeMetadata: boolean;
  onRemoveMetadataChange: (value: boolean) => void;
  sortAttrs: boolean;
  onSortAttrsChange: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] tracking-wider text-gray-400 uppercase">Precision</span>
          <span className="font-mono text-[10px] text-gray-500">{floatPrecision}</span>
        </div>
        <input
          type="range"
          min={0}
          max={5}
          value={floatPrecision}
          onChange={(e) => onFloatPrecisionChange(Number(e.target.value))}
          className="w-full"
        />
      </label>

      <div className="grid gap-2">
        <Checkbox checked={multipass} onChange={onMultipassChange} label="Run multiple passes" />
        <Checkbox checked={cleanupIds} onChange={onCleanupIdsChange} label="Minify internal IDs" />
        <Checkbox
          checked={removeMetadata}
          onChange={onRemoveMetadataChange}
          label="Remove metadata and comments"
        />
        <Checkbox
          checked={removeDimensions}
          onChange={onRemoveDimensionsChange}
          label="Remove width/height"
        />
        <Checkbox checked={sortAttrs} onChange={onSortAttrsChange} label="Sort attributes" />
      </div>
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600 select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3 w-3 cursor-pointer"
      />
      {label}
    </label>
  );
}
