import type {
  FrameShape,
  HexColor,
  ImageShape,
  RectShape,
  Shape,
  TextShape,
  Uuid,
} from '@penpot-tools/converter/types';
import type { MeasuredNode } from '../types';
import { fillsFromComputed } from '../visual/fills';
import { splitBoxShadowList, strokesFromComputed } from '../visual/strokes';
import { shadowsFromBoxShadowList } from '../visual/shadows';
import { radiusFromComputed } from '../visual/radius';
import { flexLayoutFromComputed } from '../layout/flex';
import { gridLayoutFromComputed } from '../layout/grid';
import { layoutItemFromComputed } from '../layout/layout-item';
import { tokensInInlineStyle } from '../tokens/extract';
import { buildTextContent } from './text-content';
import { buildSelrect, identityMatrix } from './selrect';
import { newShapeId } from './shape-id';
import { parseCssTransform } from './transform';
import { splitChipPatterns } from './chip-split';
import { extractInlinePx } from './css';

export interface BuildTreeInput {
  nodes: MeasuredNode[];
  pageId: Uuid;
  /** Page-absolute origin where the top-level board should be placed. */
  rootOffset: { x: number; y: number };
  /** Name of the top-level board created to hold the measured tree. */
  rootName: string;
  /** Parent of the new top-level board (page root by default). */
  parentBoardId?: Uuid;
}

export interface BuildTreeResult {
  shapes: Shape[];
  rootShapeId: Uuid;
  warnings: string[];
  /** Distinct token names referenced via `var(--...)` across the tree. */
  referencedTokens: string[];
}

/**
 * Convert a flat `MeasuredNode[]` (preorder) into Penpot `Shape`s wrapped in
 * a synthetic top-level frame ("board") at the requested page-absolute origin.
 *
 * v1 supports:
 *   - frame    (any element with element children)
 *   - rect     (leaf element with no text)
 *   - text     (leaf element with `textContent`)
 *
 * Layouts (flex/grid), images, svg, gradients, multi-run text and tokens
 * are deferred to the next phases — the tree builder records a warning when
 * it encounters them.
 */
/** Human label for a node — `data-name` if present, otherwise `<tag>`. */
function nodeLabel(node: MeasuredNode): string {
  const name = node.dataAttrs['data-name'];
  return name ? `"${name}"` : `<${node.semanticTag}>`;
}

export function buildTree(input: BuildTreeInput): BuildTreeResult {
  const warnings: string[] = [];
  // Chip pattern: a leaf element with text content + box visuals (background,
  // border, shadow) maps poorly to a Penpot text shape — text shapes don't
  // render shape-level fills/strokes when the read-mode converter produces
  // HTML, so the pill background is silently lost. Split the leaf into a
  // frame (carrying the box visuals) plus a child text shape positioned at
  // the inner content-box so padding survives the round-trip.
  const nodes = splitChipPatterns(input.nodes);
  const { rootOffset, rootName } = input;
  const parentBoardId = (input.parentBoardId ?? '00000000-0000-0000-0000-000000000000') as Uuid;

  const shapes: Shape[] = [];
  const referencedTokens = new Set<string>();

  const tops = nodes.filter((n) => n.parentIndex === null);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    if (n.rect.width === 0 && n.rect.height === 0) continue;
    minX = Math.min(minX, n.rect.x);
    minY = Math.min(minY, n.rect.y);
    maxX = Math.max(maxX, n.rect.x + n.rect.width);
    maxY = Math.max(maxY, n.rect.y + n.rect.height);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 1;
    maxY = 1;
  }
  const boardWidth = Math.max(1, Math.ceil(maxX - minX));
  const boardHeight = Math.max(1, Math.ceil(maxY - minY));

  const rootShapeId = newShapeId();
  const idByIndex = new Map<number, Uuid>();
  const shapeIdsForNode: Uuid[] = nodes.map((n) => {
    const id = (n.preserveId as Uuid) ?? newShapeId();
    idByIndex.set(n.index, id);
    return id;
  });

  // Penpot stores flex children in back-to-front Z-order — the renderer
  // reverses the array on the way out (see converter CLAUDE.md "Flex child
  // ordering"). DOM order is visual order, so we reverse for any flex
  // container regardless of `flex-direction`. Non-flex frames keep DOM order.
  const isFlexContainer = (n: MeasuredNode) =>
    n.computedStyle.display === 'flex' || n.computedStyle.display === 'inline-flex';
  const isGridContainer = (n: MeasuredNode) =>
    n.computedStyle.display === 'grid' || n.computedStyle.display === 'inline-grid';
  const childOrder = (n: MeasuredNode): number[] =>
    isFlexContainer(n) ? [...n.childIndices].reverse() : n.childIndices;

  // Top-level synthetic board that contains the measured tree.
  const boardRect = buildSelrect({
    x: rootOffset.x,
    y: rootOffset.y,
    width: boardWidth,
    height: boardHeight,
  });
  const board: FrameShape = {
    id: rootShapeId,
    name: rootName,
    type: 'frame',
    parentId: parentBoardId,
    frameId: parentBoardId,
    x: rootOffset.x,
    y: rootOffset.y,
    width: boardWidth,
    height: boardHeight,
    selrect: boardRect.selrect,
    points: boardRect.points,
    transform: identityMatrix(),
    transformInverse: identityMatrix(),
    rotation: 0,
    fills: [{ fillColor: '#FFFFFF' as HexColor, fillOpacity: 1 }],
    strokes: [],
    proportionLock: false,
    showContent: true,
    hideFillOnExport: false,
    shapes: tops.map((n) => shapeIdsForNode[n.index]!),
  };
  shapes.push(board);

  for (const node of nodes) {
    const id = shapeIdsForNode[node.index]!;
    const parent =
      node.parentIndex === null ? rootShapeId : shapeIdsForNode[node.parentIndex]!;

    // CSS `transform` produces an axis-aligned bounding box larger than the
    // element's own box. Penpot stores the unrotated rect plus a separate
    // `rotation` field — recover the unrotated dimensions from
    // `offsetWidth/Height` and centre them on the bbox centre. This assumes
    // CSS `transform-origin: 50% 50%` (the default).
    const parsedTransform = parseCssTransform(node.computedStyle.transform);
    const hasRotation = parsedTransform !== null && parsedTransform.rotationDeg !== 0;
    const useUnrotatedBox = hasRotation;
    const bboxCenterX = node.rect.x + node.rect.width / 2;
    const bboxCenterY = node.rect.y + node.rect.height / 2;
    let localWidth = useUnrotatedBox ? node.offsetWidth : node.rect.width;
    let localHeight = useUnrotatedBox ? node.offsetHeight : node.rect.height;
    let localX = useUnrotatedBox ? bboxCenterX - localWidth / 2 : node.rect.x;
    let localY = useUnrotatedBox ? bboxCenterY - localHeight / 2 : node.rect.y;

    // Flex shrink can crush a leaf with explicit `width:Npx` below N (a 1px
    // separator inside an over-constrained flex row gets shrunk to 0). The
    // authored `width:Npx` is the design intent — recover it when the measured
    // box is smaller than what the inline style asked for. We only do this for
    // leaves (no element children) so we don't fight `auto` containers.
    if (node.childIndices.length === 0 && !node.imageMediaId && !node.svgOuter) {
      const inlineW = extractInlinePx(node.inlineStyle ?? '', 'width');
      const inlineH = extractInlinePx(node.inlineStyle ?? '', 'height');
      if (inlineW !== null && inlineW > localWidth) {
        localX -= (inlineW - localWidth) / 2;
        localWidth = inlineW;
      }
      if (inlineH !== null && inlineH > localHeight) {
        localY -= (inlineH - localHeight) / 2;
        localHeight = inlineH;
      }
    }
    if (parsedTransform?.hasUnsupportedComponent) {
      warnings.push(
        `${nodeLabel(node)}: only rotate() is supported; scale/skew/3D were dropped.`,
      );
    }
    if (node.computedStyle.filter && node.computedStyle.filter !== 'none') {
      warnings.push(`${nodeLabel(node)}: CSS filter is not supported and was dropped.`);
    }
    if (node.computedStyle.mixBlendMode && node.computedStyle.mixBlendMode !== 'normal') {
      warnings.push(
        `${nodeLabel(node)}: mix-blend-mode is not supported and was dropped.`,
      );
    }

    // Page-absolute coordinates for every shape, offset by the board origin.
    const x = rootOffset.x + localX - minX;
    const y = rootOffset.y + localY - minY;
    const w = Math.max(0, localWidth);
    const h = Math.max(0, localHeight);
    const rotation = parsedTransform?.rotationDeg ?? 0;
    const rect = buildSelrect({ x, y, width: w, height: h }, rotation);

    const fills = fillsFromComputed(node.computedStyle);
    const strokeResult = strokesFromComputed(node.computedStyle);
    const strokes = strokeResult.strokes;
    const shadowEntries = splitBoxShadowList(node.computedStyle.boxShadow);
    const shadowList = shadowsFromBoxShadowList(shadowEntries, strokeResult.consumedShadowIndices);
    const shadow = shadowList.length ? shadowList : undefined;
    // The author wrote `box-shadow: …` but nothing survived parsing or stroke
    // extraction. Warn explicitly — silent drops here cost designers
    // depth/elevation cues.
    const expectedShadows = shadowEntries.length - strokeResult.consumedShadowIndices.size;
    if (expectedShadows > 0 && shadowList.length === 0) {
      warnings.push(
        `${nodeLabel(node)}: box-shadow could not be parsed and was dropped.`,
      );
    }
    const radius = radiusFromComputed(node.computedStyle);

    // Layout-item fields if the parent is a flex container.
    const parentNode = node.parentIndex !== null ? nodes[node.parentIndex] : undefined;
    const layoutItem =
      parentNode && isFlexContainer(parentNode)
        ? layoutItemFromComputed(parentNode.computedStyle, node.computedStyle)
        : {};

    const { appliedTokens, tokenNames } = tokensInInlineStyle(node.inlineStyle ?? '');
    for (const t of tokenNames) referencedTokens.add(t);
    const tokenFields =
      Object.keys(appliedTokens).length > 0 ? { appliedTokens } : {};

    if (node.svgOuter) {
      warnings.push(`${nodeLabel(node)}: inline <svg> is not supported and was skipped.`);
      continue;
    }

    const isImage = !!node.imageMediaId;
    if (node.imageSrc && !node.imageMediaId) {
      warnings.push(
        `${nodeLabel(node)}: <img src="…"> needs data-penpot-media-id (call upload_media first). Falling back to a plain rect.`,
      );
    }
    const isText = node.textContent !== undefined && node.childIndices.length === 0;
    const isContainer = node.childIndices.length > 0 && !isImage;

    if (isImage) {
      const image: ImageShape = {
        id,
        name: node.dataAttrs['data-name'] ?? 'Image',
        type: 'image',
        parentId: parent,
        frameId: parent,
        x,
        y,
        width: w,
        height: h,
        selrect: rect.selrect,
        points: rect.points,
        transform: identityMatrix(),
        transformInverse: identityMatrix(),
        rotation,
        proportionLock: false,
        metadata: {
          id: node.imageMediaId as Uuid,
          width: node.imageNaturalWidth ?? Math.round(w),
          height: node.imageNaturalHeight ?? Math.round(h),
          mtype: node.imageMediaType ?? 'image/png',
        },
        ...layoutItem,
        ...tokenFields,
      };
      shapes.push(image);
    } else if (isContainer) {
      const flex = flexLayoutFromComputed(node.computedStyle);
      const gridChildren = isGridContainer(node)
        ? node.childIndices.map((i) => ({ node: nodes[i]!, shapeId: shapeIdsForNode[i]! }))
        : [];
      const grid = isGridContainer(node)
        ? gridLayoutFromComputed(node.computedStyle, gridChildren)
        : null;
      const frame: FrameShape = {
        id,
        name: node.dataAttrs['data-name'] ?? node.semanticTag,
        type: 'frame',
        parentId: parent,
        frameId: parent,
        x,
        y,
        width: w,
        height: h,
        selrect: rect.selrect,
        points: rect.points,
        transform: identityMatrix(),
        transformInverse: identityMatrix(),
        rotation,
        fills,
        strokes,
        ...(shadow ? { shadow } : {}),
        proportionLock: false,
        showContent: true,
        hideFillOnExport: false,
        ...radius,
        ...layoutItem,
        ...tokenFields,
        ...flex,
        ...grid,
        shapes: childOrder(node).map((i) => shapeIdsForNode[i]!),
      };
      shapes.push(frame);
    } else if (isText) {
      // Penpot's text engine and headless Chromium disagree on glyph metrics
      // by a fraction of a pixel (font-shaping, sub-pixel rounding, trailing
      // letter-spacing). A width measured tight to the headless render
      // sometimes wraps to a second line in Penpot. A small slack absorbs the
      // delta without visibly affecting layout — the text shape is anchored
      // top-left, so 2 extra px on the right is invisible.
      const textWidth = Math.ceil(w) + 2;
      const text: TextShape = {
        id,
        name: node.dataAttrs['data-name'] ?? node.semanticTag,
        type: 'text',
        parentId: parent,
        frameId: parent,
        x,
        y,
        width: textWidth,
        height: h,
        selrect: rect.selrect,
        points: rect.points,
        transform: identityMatrix(),
        transformInverse: identityMatrix(),
        rotation,
        growType: 'fixed',
        content: buildTextContent(node.textContent!, node.computedStyle),
        // `fills` / `strokes` / `shadow` / `radius` are kept as a defensive
        // belt — chip-pattern leaves are split into frame+text by
        // `splitChipPatterns()` before reaching here, so a text shape arriving
        // with a background fill is unusual but harmless.
        fills,
        strokes,
        ...(shadow ? { shadow } : {}),
        ...radius,
        proportionLock: false,
        ...layoutItem,
        ...tokenFields,
      };
      shapes.push(text);
    } else {
      const rectShape: RectShape = {
        id,
        name: node.dataAttrs['data-name'] ?? node.semanticTag,
        type: 'rect',
        parentId: parent,
        frameId: parent,
        x,
        y,
        width: w,
        height: h,
        selrect: rect.selrect,
        points: rect.points,
        transform: identityMatrix(),
        transformInverse: identityMatrix(),
        rotation,
        fills,
        strokes,
        ...(shadow ? { shadow } : {}),
        proportionLock: false,
        ...radius,
        ...layoutItem,
        ...tokenFields,
      };
      shapes.push(rectShape);
    }
  }

  return { shapes, rootShapeId, warnings, referencedTokens: Array.from(referencedTokens) };
}
