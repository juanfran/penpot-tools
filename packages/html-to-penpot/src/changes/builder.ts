import type { FileChange, Shape, Uuid } from '@penpot-tools/converter/types';

/**
 * Penpot's actual `update-file` change schema is `:add-obj` (singular) per
 * shape, not the `:add-objects` plural shape that lives in the OpenAPI types.
 * The change carries the placement (`pageId`, `parentId`, `frameId`, optional
 * `index`) at the top level — duplicated on `obj` for legacy reasons but
 * authoritative at the change level.
 */
interface AddObjChange {
  type: 'add-obj';
  id: Uuid;
  pageId: Uuid;
  parentId: Uuid;
  frameId: Uuid;
  obj: Shape;
  index?: number;
  ignoreTouched?: boolean;
}

interface RegObjectsChange {
  type: 'reg-objects';
  pageId: Uuid;
  shapes: Uuid[];
}

/**
 * Emit one `add-obj` change per shape, in topological order (parents before
 * children). The input `shapes` array is already in document order from the
 * tree builder, so a straight map preserves that.
 */
export function shapesToAddChanges(shapes: Shape[], pageId: Uuid): FileChange[] {
  return shapes.map((shape, index) => {
    const change: AddObjChange = {
      type: 'add-obj',
      id: shape.id,
      pageId,
      parentId: shape.parentId,
      frameId: shape.frameId,
      obj: shape,
      index,
    };
    return change as unknown as FileChange;
  });
}

export function regObjectsChange(pageId: Uuid, shapeIds: Uuid[]): FileChange {
  const change: RegObjectsChange = { type: 'reg-objects', pageId, shapes: shapeIds };
  return change as unknown as FileChange;
}
