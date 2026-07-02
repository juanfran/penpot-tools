import { type ShapeTreeNode } from '#/lib/server/penpot-api';
import type { AssetDownloadResult } from '#/lib/asset-download-types';

export interface Asset {
  id: string;
  name: string;
  kind: 'image' | 'svg';
  src?: string;
  svg?: string;
}

export function buildNodeIndex(
  nodes: ShapeTreeNode[],
  map: Map<string, ShapeTreeNode> = new Map(),
): Map<string, ShapeTreeNode> {
  for (const n of nodes) {
    map.set(n.id, n);
    buildNodeIndex(n.children, map);
  }
  return map;
}

const BG_URL_REGEX = /url\((['"]?)([^)'"]+)\1\)/g;

// Reads assets directly from the live DOM subtree of the selected shape,
// avoiding a full reparse of the root shape's HTML (which can be huge).
//
// Covers the four render paths from the converter:
//   - <img data-type="image"> for image shapes
//   - <div data-type="svg-raw"> wrapping raw SVG markup
//   - <svg data-id="..."> for path/bool shapes (rendered as standalone SVGs)
//   - any shape with an image fill renders as background-image: url(...)
//     (rect/circle/frame/etc. — see converter/visual/fills.ts)
export function collectAssetsFromDom(
  selectedShapeId: string,
  nodeIndex: Map<string, ShapeTreeNode>,
): Asset[] {
  if (typeof document === 'undefined') return [];
  const root = document.querySelector<HTMLElement>(`[data-id="${CSS.escape(selectedShapeId)}"]`);
  if (!root) return [];

  const out: Asset[] = [];
  const seenSrcs = new Set<string>();
  const seenSvgIds = new Set<string>();

  const pushImage = (id: string, name: string, src: string, layerIdx: number) => {
    if (seenSrcs.has(src)) return;
    seenSrcs.add(src);
    out.push({ id: layerIdx > 0 ? `${id}-bg-${layerIdx}` : id, name, kind: 'image', src });
  };

  const pushSvg = (id: string, name: string, svg: string) => {
    if (seenSvgIds.has(id) || !svg) return;
    seenSvgIds.add(id);
    out.push({ id, name, kind: 'svg', svg });
  };

  // Paths are emitted with a viewBox offset to page-absolute coords (see
  // converter/shapes/path.ts) — the preview renders fine but standalone copies
  // are positioned far from origin. Normalize to viewBox="0 0 w h" and shift
  // contents into a translating <g>, so downloads and pastes stay at origin.
  const normalizeStandaloneSvg = (svgEl: Element): string => {
    const clone = svgEl.cloneNode(true) as SVGElement;
    clone.removeAttribute('data-id');
    clone.removeAttribute('data-type');
    clone.removeAttribute('style');
    const viewBox = clone.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      if (parts.length === 4 && parts.every(Number.isFinite)) {
        const [x, y, w, h] = parts;
        if (x !== 0 || y !== 0) {
          clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.setAttribute('transform', `translate(${-x}, ${-y})`);
          while (clone.firstChild) g.appendChild(clone.firstChild);
          clone.appendChild(g);
        }
      }
    }
    return clone.outerHTML;
  };

  // Primary: <img>, <div data-type="svg-raw">, and standalone <svg data-id>
  const primaryEls: Element[] = [];
  const rootType = root.getAttribute('data-type');
  const rootIsSvg = root.tagName.toLowerCase() === 'svg';
  if (rootType === 'image' || rootType === 'svg-raw' || rootIsSvg) primaryEls.push(root);
  primaryEls.push(
    ...Array.from(
      root.querySelectorAll('[data-type="image"], [data-type="svg-raw"], svg[data-id]'),
    ),
  );

  for (const el of primaryEls) {
    const id = el.getAttribute('data-id');
    if (!id) continue;
    const name = nodeIndex.get(id)?.name ?? id;
    const type = el.getAttribute('data-type');
    const tagName = el.tagName.toLowerCase();
    if (type === 'image' && tagName === 'img') {
      const src = el.getAttribute('src');
      if (src) pushImage(id, name, src, 0);
    } else if (type === 'svg-raw') {
      pushSvg(id, name, el.innerHTML.trim());
    } else if (tagName === 'svg') {
      // Skip SVGs nested inside a svg-raw wrapper (the wrapper already owns them)
      if (el !== root && el.closest('[data-type="svg-raw"]')) continue;
      pushSvg(id, name, normalizeStandaloneSvg(el));
    }
  }

  // Image fills rendered as background-image: url(...) on any shape type
  const bgEls: HTMLElement[] = [];
  if (root.hasAttribute('data-id') && root.style.backgroundImage) bgEls.push(root);
  bgEls.push(
    ...Array.from(root.querySelectorAll<HTMLElement>('[data-id][style*="background-image"]')),
  );

  for (const el of bgEls) {
    const id = el.getAttribute('data-id');
    if (!id) continue;
    const name = nodeIndex.get(id)?.name ?? id;
    const bg = el.style.backgroundImage;
    if (!bg || bg === 'none') continue;
    BG_URL_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    let layerIdx = 0;
    while ((m = BG_URL_REGEX.exec(bg)) !== null) {
      const src = m[2];
      // Skip intra-document references (mask/clipPath via url(#id))
      if (!src || src.startsWith('#')) continue;
      pushImage(id, name, src, layerIdx);
      layerIdx++;
    }
  }

  return out;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadPreparedAsset(result: AssetDownloadResult) {
  const bytes = Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0));
  triggerBlobDownload(new Blob([bytes], { type: result.mimeType }), result.filename);
}
