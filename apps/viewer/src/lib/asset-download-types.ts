export type AssetDownloadMode = 'original' | 'optimized';

export type ImageOutputFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ImageDownloadOptions {
  mode: AssetDownloadMode;
  format?: ImageOutputFormat;
  quality?: number;
  maxSide?: number | null;
}

export interface SvgDownloadOptions {
  mode: AssetDownloadMode;
  multipass?: boolean;
  floatPrecision?: number;
  cleanupIds?: boolean;
  removeDimensions?: boolean;
  removeMetadata?: boolean;
  sortAttrs?: boolean;
}

export interface AssetDownloadResult {
  filename: string;
  mimeType: string;
  base64: string;
}
