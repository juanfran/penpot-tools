import { type ShapeTreeNode } from '#/lib/server/penpot-api';

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
      pushSvg(id, name, el.outerHTML);
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

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned.slice(0, 200) || 'asset';
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

export async function downloadImageAsset(src: string, baseName: string) {
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const ext = (blob.type.split('/')[1] || 'png').split(';')[0];
    triggerBlobDownload(blob, `${sanitizeFilename(baseName)}.${ext}`);
  } catch {
    // CORS or network failure — fall back to opening the asset in a new tab
    window.open(src, '_blank', 'noopener');
  }
}

export function downloadSvgAsset(markup: string, baseName: string) {
  const trimmed = markup.trim();
  const hasSvgRoot = /^<svg[\s>]/i.test(trimmed);
  const content = hasSvgRoot ? trimmed : `<svg xmlns="http://www.w3.org/2000/svg">${trimmed}</svg>`;
  const blob = new Blob([content], { type: 'image/svg+xml' });
  triggerBlobDownload(blob, `${sanitizeFilename(baseName)}.svg`);
}
