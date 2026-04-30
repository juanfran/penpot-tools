import type { Shape, Uuid } from '@penpot-tools/converter/types';

/**
 * Walk the built shape tree and warn when a shape is fully covered by a
 * later-painting (DOM-later) sibling/cousin with an opaque fill.
 *
 * This catches the most common silent-design bug: an LLM places a small
 * detail (price chip, photo counter, label) and a later, larger element
 * (price block, photo overlay) lands on top, hiding the first. The pixel
 * output looks intentional in the renderer — the missing layer only shows
 * up when the designer opens Penpot.
 *
 * Heuristic — kept conservative on purpose so the warning rarely fires
 * incorrectly:
 *   - Skip rotated shapes (axis-aligned bbox can't reliably contain or be
 *     contained by a rotated rect).
 *   - Skip ancestor/descendant pairs (a frame with a background isn't
 *     occluding its own children — they paint on top of it).
 *   - The occluder must be FULLY covering the occluded shape's bbox.
 *   - The occluder must have at least one fill with `fillOpacity ≥ 0.95`
 *     (semi-transparent overlays don't hide what's behind them).
 *
 * Returns one warning per occluded shape. Each warning names the hidden
 * shape and the occluder so the LLM can act without re-investigating.
 */
const OPAQUE_THRESHOLD = 0.95;

interface FillEntry {
  fillOpacity?: number;
  fillColor?: string;
  fillColorGradient?: { stops: { opacity?: number }[] };
}

interface ShapeWithFills {
  fills?: FillEntry[];
}

function isOpaqueFill(f: FillEntry): boolean {
  // Solid colour: fillOpacity covers the whole shape.
  if (f.fillColor) {
    return (f.fillOpacity ?? 1) >= OPAQUE_THRESHOLD;
  }
  // Gradient: occluding only if every stop is opaque. A gradient with a
  // transparent stop (common for legibility shades) lets earlier shapes
  // bleed through, so it must NOT trigger the warning.
  if (f.fillColorGradient) {
    const stops = f.fillColorGradient.stops ?? [];
    if (stops.length === 0) return false;
    return stops.every((s) => (s.opacity ?? 1) >= OPAQUE_THRESHOLD);
  }
  return false;
}

function hasOpaqueFill(s: Shape): boolean {
  const fills = (s as Shape & ShapeWithFills).fills;
  if (!fills || fills.length === 0) return false;
  return fills.some(isOpaqueFill);
}

interface BoundedShape {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Pull the AABB; defaults to 0/0 when a Shape variant doesn't carry it. */
function bounds(s: Shape): BoundedShape {
  const v = s as Partial<BoundedShape>;
  return { x: v.x ?? 0, y: v.y ?? 0, width: v.width ?? 0, height: v.height ?? 0 };
}

function fullyContains(outer: Shape, inner: Shape): boolean {
  const o = bounds(outer);
  const i = bounds(inner);
  return (
    o.x <= i.x + 0.5 &&
    o.y <= i.y + 0.5 &&
    o.x + o.width + 0.5 >= i.x + i.width &&
    o.y + o.height + 0.5 >= i.y + i.height
  );
}

export function detectOcclusions(shapes: Shape[], rootShapeId: Uuid): string[] {
  // Build child / descendant / ancestor lookups once.
  const byId = new Map<Uuid, Shape>();
  for (const s of shapes) byId.set(s.id, s);

  const childrenOf = new Map<Uuid, Uuid[]>();
  for (const s of shapes) {
    if (s.id === s.parentId) continue;
    const arr = childrenOf.get(s.parentId) ?? [];
    arr.push(s.id);
    childrenOf.set(s.parentId, arr);
  }

  const descendantsCache = new Map<Uuid, Set<Uuid>>();
  function descendantsOf(id: Uuid): Set<Uuid> {
    const cached = descendantsCache.get(id);
    if (cached) return cached;
    const out = new Set<Uuid>();
    const stack = [...(childrenOf.get(id) ?? [])];
    while (stack.length) {
      const c = stack.pop()!;
      if (out.has(c)) continue;
      out.add(c);
      for (const cc of childrenOf.get(c) ?? []) stack.push(cc);
    }
    descendantsCache.set(id, out);
    return out;
  }

  const ancestorsCache = new Map<Uuid, Set<Uuid>>();
  function ancestorsOf(id: Uuid): Set<Uuid> {
    const cached = ancestorsCache.get(id);
    if (cached) return cached;
    const out = new Set<Uuid>();
    let cur: Uuid | undefined = id;
    while (cur) {
      const sh = byId.get(cur);
      if (!sh || sh.id === sh.parentId) break;
      out.add(sh.parentId);
      cur = sh.parentId;
    }
    ancestorsCache.set(id, out);
    return out;
  }

  const warnings: string[] = [];

  for (let i = 0; i < shapes.length; i++) {
    const s = shapes[i]!;
    if (s.id === rootShapeId) continue;
    if ((s.rotation ?? 0) !== 0) continue;
    // Empty shapes can't be visibly occluded — skip.
    const sb = bounds(s);
    if (sb.width <= 0 || sb.height <= 0) continue;

    const sAnc = ancestorsOf(s.id);
    const sDesc = descendantsOf(s.id);

    for (let j = i + 1; j < shapes.length; j++) {
      const l = shapes[j]!;
      if (l.id === rootShapeId) continue;
      if ((l.rotation ?? 0) !== 0) continue;
      if (sAnc.has(l.id)) continue;
      if (sDesc.has(l.id)) continue;
      if (!hasOpaqueFill(l)) continue;
      if (!fullyContains(l, s)) continue;

      warnings.push(
        `"${s.name}" is fully covered by later sibling "${l.name}" (opaque fill, paints on top) — it will be invisible. Reorder the DOM so "${s.name}" comes after "${l.name}", or move one of them.`,
      );
      break;
    }
  }

  return warnings;
}
