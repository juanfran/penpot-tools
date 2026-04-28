import { randomUUID } from 'node:crypto';
import type { Uuid } from '@penpot-tools/converter/types';

/**
 * Generate a fresh shape id. Penpot accepts arbitrary v4 UUIDs for new shapes
 * — it doesn't require the v7 ordering of the file id.
 */
export function newShapeId(): Uuid {
  return randomUUID() as Uuid;
}
