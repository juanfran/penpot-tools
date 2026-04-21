const TRANSFORM_STORAGE_PREFIX = 'penpot-viewer:transform';

export type SavedTransform = { scale: number; positionX: number; positionY: number };

function transformStorageKey(fileId: string, pageId: string) {
  return `${TRANSFORM_STORAGE_PREFIX}:${fileId}:${pageId}`;
}

export function loadTransform(fileId: string, pageId: string): SavedTransform | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(transformStorageKey(fileId, pageId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.scale === 'number' &&
      typeof parsed.positionX === 'number' &&
      typeof parsed.positionY === 'number'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveTransform(fileId: string, pageId: string, state: SavedTransform) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(transformStorageKey(fileId, pageId), JSON.stringify(state));
  } catch {
    /* ignore quota or access errors */
  }
}
