import { measureHtml } from './measure/headless';
import { buildTree } from './build/tree';
import { regObjectsChange, shapesToAddChanges } from './changes/builder';
import type { BuildContext, ChangeBundle } from './types';

export type { BuildContext, ChangeBundle, MeasuredNode } from './types';
export { measureHtml } from './measure/headless';
export { buildTree } from './build/tree';

/**
 * Translate an HTML document into a list of Penpot `update-file` changes.
 *
 * Pipeline:
 *   1. Render `html` in headless Chromium (with optional tokens / fonts).
 *   2. Walk the DOM, collecting `MeasuredNode`s with computed styles.
 *   3. Build a tree of Penpot `Shape`s wrapped in a synthetic top-level board.
 *   4. Emit `add-objects` changes (one per shape, parent-first) plus a final
 *      `reg-objects` so Penpot recomputes the parent's bounding box.
 *
 * The caller is responsible for sending the changes to Penpot via update-file
 * and supplying the current `revn`. Changes do not include media uploads —
 * those are handled separately by `upload_media`.
 */
export async function htmlToChanges(html: string, ctx: BuildContext): Promise<ChangeBundle> {
  const { nodes } = await measureHtml({
    html,
    tokensCss: ctx.tokensCss,
    fontsCss: ctx.fontsCss,
    background: ctx.background,
    maxWidth: ctx.maxWidth,
    maxHeight: ctx.maxHeight,
  });

  const { shapes, rootShapeId, warnings } = buildTree({
    nodes,
    pageId: ctx.pageId,
    rootOffset: ctx.rootPosition ?? { x: 0, y: 0 },
    rootName: ctx.rootName ?? 'New design',
    parentBoardId: ctx.parentId,
  });

  const addChanges = shapesToAddChanges(shapes, ctx.pageId);
  const regChange = regObjectsChange(ctx.pageId, [rootShapeId]);
  const createdShapeIds = shapes.map((s) => s.id);

  return {
    changes: [...addChanges, regChange],
    rootShapeId,
    createdShapeIds,
    warnings,
  };
}
