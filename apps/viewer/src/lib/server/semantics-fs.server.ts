/**
 * Thin re-export of the converter's filesystem helpers so the rest of the
 * viewer can keep importing from the existing path. The actual storage
 * implementation (cache, JSON shape, fileId validation) lives in
 * `@penpot-tools/converter/semantics-store` and is shared with the MCP.
 */
export {
  readSemanticsFromDisk,
  writeSemanticsToDisk,
  _resetSemanticsCacheForTesting,
} from '@penpot-tools/converter/semantics-store';

import { readSemanticsFromDisk } from '@penpot-tools/converter/semantics-store';
import type { SemanticRule } from '@penpot-tools/converter/shape-code';

/** Backwards-compatible alias used by older callers. */
export async function readSemanticsFor(fileId: string): Promise<SemanticRule[]> {
  return readSemanticsFromDisk(fileId);
}
