/**
 * Source of the in-page DOM walker. This file is read as a string by the
 * headless driver and injected into the page via `page.evaluate(walkSource)`.
 *
 * It MUST be self-contained — no imports, no closure references — because it
 * runs in the browser context where TypeScript types are erased and our
 * package's runtime is not available.
 */
export const WALKER_SOURCE = `
(() => {
  const STYLE_KEYS = [
    'display','position','transform','opacity','mixBlendMode','filter',
    'backgroundColor','backgroundImage',
    'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
    'borderTopColor','borderTopStyle',
    'borderTopLeftRadius','borderTopRightRadius','borderBottomRightRadius','borderBottomLeftRadius',
    'boxShadow',
    'flexDirection','justifyContent','alignItems','rowGap','columnGap',
    'paddingTop','paddingRight','paddingBottom','paddingLeft',
    'gridTemplateColumns','gridTemplateRows','gridRowStart','gridColumnStart',
    'fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing',
    'color','textAlign',
    'flexGrow','flexShrink','flexBasis',
    'width','height'
  ];

  const inner = document.getElementById('penpot-inner');
  if (!inner) return { nodes: [], origin: { x: 0, y: 0 } };

  // Compute the bounding rect across all visible descendants and use it as origin.
  const all = Array.from(inner.querySelectorAll('*'));
  let minLeft = Infinity, minTop = Infinity;
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.left < minLeft) minLeft = r.left;
    if (r.top < minTop) minTop = r.top;
  }
  if (!Number.isFinite(minLeft)) {
    const cRect = inner.getBoundingClientRect();
    minLeft = cRect.left;
    minTop = cRect.top;
  }

  const nodes = [];
  const tagRe = /^[a-zA-Z][a-zA-Z0-9-]*$/;

  function isElementOnly(el) {
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) return false;
    }
    return true;
  }

  function pickStyle(el) {
    const cs = getComputedStyle(el);
    const out = {};
    for (const k of STYLE_KEYS) out[k] = cs[k] || '';
    return out;
  }

  function pickDataAttrs(el) {
    const out = {};
    const attrs = el.attributes;
    for (let i = 0; i < attrs.length; i++) {
      const a = attrs[i];
      if (a.name.indexOf('data-') === 0) out[a.name] = a.value;
    }
    return out;
  }

  function getTextContent(el) {
    // Only return text if there are no element children (pure text leaf).
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) return undefined;
    }
    const t = el.textContent;
    return t && t.trim().length > 0 ? t : undefined;
  }

  function walk(el, parentIndex) {
    const tag = el.tagName ? el.tagName.toLowerCase() : 'div';
    if (!tagRe.test(tag)) return;

    const r = el.getBoundingClientRect();
    const rect = {
      x: r.left - minLeft,
      y: r.top - minTop,
      width: r.width,
      height: r.height,
    };

    const dataAttrs = pickDataAttrs(el);
    const node = {
      index: nodes.length,
      parentIndex,
      childIndices: [],
      semanticTag: tag,
      rect,
      computedStyle: pickStyle(el),
      dataAttrs,
    };

    if (dataAttrs['data-penpot-id']) node.preserveId = dataAttrs['data-penpot-id'];

    if (tag === 'img') {
      const img = el;
      node.imageSrc = img.getAttribute('src') || '';
      const mediaId = img.getAttribute('data-penpot-media-id');
      if (mediaId) node.imageMediaId = mediaId;
      const mediaType = img.getAttribute('data-penpot-media-type');
      if (mediaType) node.imageMediaType = mediaType;
      if (img.naturalWidth) node.imageNaturalWidth = img.naturalWidth;
      if (img.naturalHeight) node.imageNaturalHeight = img.naturalHeight;
    } else if (tag === 'svg') {
      node.svgOuter = el.outerHTML;
    } else {
      const text = getTextContent(el);
      if (text !== undefined) node.textContent = text;
    }

    const myIndex = nodes.length;
    nodes.push(node);
    if (parentIndex !== null) nodes[parentIndex].childIndices.push(myIndex);

    // Recurse only when this element has element children. <svg>/<img> are leaves.
    if (tag !== 'svg' && tag !== 'img' && !isElementOnly(el)) {
      for (const child of Array.from(el.children)) walk(child, myIndex);
    }
  }

  for (const child of Array.from(inner.children)) walk(child, null);

  return { nodes, origin: { x: minLeft, y: minTop } };
})();
`.trim();
