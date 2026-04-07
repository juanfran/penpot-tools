import { existsSync } from 'fs';
import { join } from 'path';
import type { Uuid } from '../../penpot.types';

/** 1×1 transparent PNG in base64 — used as a placeholder for missing images */
const PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** Builds the `file://` URL for an image id under `baseDir/images/<id>.png`. */
export function buildFilePath(baseDir: string, id: Uuid): string {
  return `file://${join(baseDir, 'images', `${id}.png`)}`;
}

/**
 * Creates a resolver that maps Penpot image IDs to local `file://` URLs.
 *
 * Looks for files at `baseDir/images/<id>.png`. If the file does not exist,
 * returns a 1×1 transparent PNG data URI to avoid broken images.
 */
export function createFileResolver(baseDir: string): (id: Uuid) => string {
  return (id: Uuid): string => {
    const filePath = join(baseDir, 'images', `${id}.png`);
    if (!existsSync(filePath)) return PLACEHOLDER;
    return `file://${filePath}`;
  };
}
