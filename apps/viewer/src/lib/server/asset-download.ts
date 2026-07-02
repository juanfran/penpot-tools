import { createServerFn } from '@tanstack/react-start';
import sharp from 'sharp';
import { optimize, type Config as SvgoConfig } from 'svgo';
import z from 'zod';

import { authMiddleware } from '../middlewares/auth.middleware';
import type { AssetDownloadResult, ImageOutputFormat } from '../asset-download-types';

const PENPOT_ORIGIN = 'https://design.penpot.app';
const MAX_ASSET_BYTES = 25 * 1024 * 1024;

const imageInputSchema = z.object({
  kind: z.literal('image'),
  src: z.url(),
  baseName: z.string().min(1),
  mode: z.enum(['original', 'optimized']),
  format: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
  quality: z.number().min(1).max(100).optional(),
  maxSide: z.number().int().min(64).max(16_384).nullable().optional(),
});

const svgInputSchema = z.object({
  kind: z.literal('svg'),
  markup: z.string().min(1),
  baseName: z.string().min(1),
  mode: z.enum(['original', 'optimized']),
  multipass: z.boolean().optional(),
  floatPrecision: z.number().int().min(0).max(5).optional(),
  cleanupIds: z.boolean().optional(),
  removeDimensions: z.boolean().optional(),
  removeMetadata: z.boolean().optional(),
  sortAttrs: z.boolean().optional(),
});

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned.slice(0, 200) || 'asset';
}

function extensionFromMime(mime: string): string | null {
  const normalized = mime.toLowerCase().split(';')[0];
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/svg+xml') return 'svg';
  const match = /^image\/([a-z0-9.+-]+)$/.exec(normalized);
  return match ? match[1].replace('x-', '') : null;
}

function extensionFromUrl(src: string): string | null {
  const path = new URL(src).pathname;
  const match = /\.([a-z0-9]+)$/i.exec(path);
  return match?.[1].toLowerCase() ?? null;
}

function normalizeSvgAsset(markup: string): string {
  const trimmed = markup.trim();
  const hasSvgRoot = /^<svg[\s>]/i.test(trimmed);
  return hasSvgRoot ? trimmed : `<svg xmlns="http://www.w3.org/2000/svg">${trimmed}</svg>`;
}

function assertAllowedPenpotAssetUrl(src: string): URL {
  const url = new URL(src);
  if (url.origin !== PENPOT_ORIGIN || !url.pathname.startsWith('/assets/by-file-media-id/')) {
    throw new Error('Only Penpot file media assets can be downloaded by the server.');
  }
  return url;
}

async function fetchImageAsset(
  token: string,
  src: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const url = assertAllowedPenpotAssetUrl(src);
  const res = await fetch(url, {
    headers: {
      Authorization: `Token ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Penpot asset fetch failed (${res.status}): ${text || res.statusText}`);
  }

  const mimeType = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  if (!mimeType.startsWith('image/')) {
    throw new Error(`Unsupported asset type: ${mimeType || 'unknown'}.`);
  }

  const length = Number(res.headers.get('content-length') ?? '');
  if (Number.isFinite(length) && length > MAX_ASSET_BYTES) {
    throw new Error(`Asset is ${length} bytes; exceeds the ${MAX_ASSET_BYTES}-byte limit.`);
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_ASSET_BYTES) {
    throw new Error(
      `Asset is ${arrayBuffer.byteLength} bytes; exceeds the ${MAX_ASSET_BYTES}-byte limit.`,
    );
  }

  return { buffer: Buffer.from(arrayBuffer), mimeType };
}

async function optimizeImage(
  buffer: Buffer,
  options: {
    format: ImageOutputFormat;
    quality: number;
    maxSide?: number | null;
  },
): Promise<{ buffer: Buffer; mimeType: string }> {
  let pipeline = sharp(buffer, { animated: false }).rotate();
  if (options.maxSide) {
    pipeline = pipeline.resize({
      width: options.maxSide,
      height: options.maxSide,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  if (options.format === 'image/jpeg') {
    return {
      buffer: await pipeline
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: options.quality, mozjpeg: true })
        .toBuffer(),
      mimeType: 'image/jpeg',
    };
  }

  if (options.format === 'image/webp') {
    return {
      buffer: await pipeline.webp({ quality: options.quality, effort: 5 }).toBuffer(),
      mimeType: 'image/webp',
    };
  }

  return {
    buffer: await pipeline.png({ compressionLevel: 9, effort: 7 }).toBuffer(),
    mimeType: 'image/png',
  };
}

function optimizeSvg(
  markup: string,
  baseName: string,
  options: z.infer<typeof svgInputSchema>,
): string {
  const plugins: SvgoConfig['plugins'] = [
    {
      name: 'preset-default',
      params: {
        overrides: {
          cleanupIds: options.cleanupIds === false ? false : undefined,
          removeComments: options.removeMetadata === false ? false : undefined,
          removeDesc: options.removeMetadata === false ? false : undefined,
          removeEditorsNSData: options.removeMetadata === false ? false : undefined,
          removeMetadata: options.removeMetadata === false ? false : undefined,
          removeViewBox: false,
        },
      },
    },
  ];

  if (options.removeDimensions) plugins.push('removeDimensions');
  if (options.sortAttrs) plugins.push('sortAttrs');

  return optimize(normalizeSvgAsset(markup), {
    multipass: options.multipass ?? true,
    floatPrecision: options.floatPrecision ?? 3,
    path: `${sanitizeFilename(baseName)}.svg`,
    plugins,
  }).data;
}

function toResult(buffer: Buffer, mimeType: string, filename: string): AssetDownloadResult {
  return {
    filename,
    mimeType,
    base64: buffer.toString('base64'),
  };
}

export const prepareAssetDownloadFn = createServerFn({ method: 'POST' })
  .inputValidator(z.discriminatedUnion('kind', [imageInputSchema, svgInputSchema]))
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<AssetDownloadResult> => {
    const baseName = sanitizeFilename(data.baseName);

    if (data.kind === 'svg') {
      const content =
        data.mode === 'optimized'
          ? optimizeSvg(data.markup, baseName, data)
          : normalizeSvgAsset(data.markup);
      const suffix = data.mode === 'optimized' ? '.optimized' : '';
      return toResult(Buffer.from(content), 'image/svg+xml', `${baseName}${suffix}.svg`);
    }

    const asset = await fetchImageAsset(context.token, data.src);
    if (data.mode === 'optimized') {
      const format = data.format ?? 'image/webp';
      const optimized = await optimizeImage(asset.buffer, {
        format,
        quality: data.quality ?? 82,
        maxSide: data.maxSide ?? null,
      });
      const ext = extensionFromMime(optimized.mimeType) ?? 'webp';
      return toResult(optimized.buffer, optimized.mimeType, `${baseName}.optimized.${ext}`);
    }

    const ext = extensionFromMime(asset.mimeType) ?? extensionFromUrl(data.src) ?? 'png';
    return toResult(asset.buffer, asset.mimeType, `${baseName}.${ext}`);
  });
