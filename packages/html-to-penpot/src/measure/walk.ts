/**
 * Tags whose content must not become Penpot shapes. Most are `display:none`
 * by user-agent default (`<style>`, `<script>`, `<head>`, ...), but the walker
 * still picks them up via `getBoundingClientRect()` returning 0×0 *and*
 * `textContent` returning their inner CSS / JS source — which then
 * materialises as a stray text shape on the canvas.
 *
 * Exported so it can be unit-tested without booting Playwright.
 */
export const NON_RENDERABLE_TAGS = [
  'style',
  'script',
  'meta',
  'link',
  'head',
  'title',
  'noscript',
  'template',
  'base',
] as const;

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
  const NON_RENDERABLE = ${JSON.stringify(NON_RENDERABLE_TAGS)};
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
    'color','textAlign','textTransform',
    'flexGrow','flexShrink','flexBasis',
    'width','height'
  ];

  const inner = document.getElementById('penpot-inner');
  if (!inner) return { nodes: [], warnings: [], origin: { x: 0, y: 0 } };

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
  const warnings = [];
  const tagRe = /^[a-zA-Z][a-zA-Z0-9-]*$/;

  // <br> is a structural line break inside a text run, NOT a separate child
  // shape. The walker treats elements that mix text + <br> (and only <br>) as
  // a single text leaf — the joined text carries explicit "\\n" markers that
  // Penpot's text engine renders as paragraph breaks. Without this special-
  // case the LLM-natural \`<div>Casa<br/>Olivar</div>\` lost both runs because
  // the parent fell out of the text branch and the <br> became a 0-px rect.
  function isLeafLikeForText(el) {
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = child.tagName ? child.tagName.toLowerCase() : '';
      if (tag !== 'br') return false;
    }
    return true;
  }

  // Detects "orphan text": a non-whitespace text node living alongside element
  // children (e.g. <p>Hello <span>world</span></p> — "Hello " is dropped because
  // the walker only captures text on pure leaves). Returns the dropped runs so
  // we can show them in the warning. <br>-only siblings don't count as
  // "elements" here — those mix-with-text patterns are now captured.
  function orphanTextRuns(el) {
    let hasNonBrElementChild = false;
    for (const c of Array.from(el.childNodes)) {
      if (c.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = c.tagName ? c.tagName.toLowerCase() : '';
      if (tag !== 'br') { hasNonBrElementChild = true; break; }
    }
    if (!hasNonBrElementChild) return null;
    const runs = [];
    for (const c of Array.from(el.childNodes)) {
      if (c.nodeType !== Node.TEXT_NODE) continue;
      const t = c.textContent;
      if (t && t.trim().length > 0) runs.push(t.trim());
    }
    return runs.length ? runs : null;
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

  // Source HTML often carries newlines/indent inside the element open/close
  // tags — these are visually collapsed by the browser but kept verbatim in
  // \`textContent\`, so the stored Penpot string ends up with stray leading
  // whitespace ("\\n    Tramuntana…\\n  "). Match the browser's default
  // \`white-space: normal\`: collapse internal whitespace runs to one space and
  // trim each line's edges. Authors who really want hard whitespace can use
  // explicit characters or add a \`<pre>\` wrapper later.
  function normalizeLine(line) {
    return line.replace(/\\s+/g, ' ').replace(/^ | $/g, '');
  }

  function getTextContent(el) {
    // Pure text leaf OR text + <br> only — both become a single text shape.
    // Anything else means the element has real element children, so it must
    // become a frame and its loose text runs (if any) are picked up as
    // "orphan text" warnings instead.
    let hasNonBrElement = false;
    let hasBr = false;
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = child.tagName ? child.tagName.toLowerCase() : '';
      if (tag === 'br') { hasBr = true; continue; }
      hasNonBrElement = true;
      break;
    }
    if (hasNonBrElement) return undefined;

    if (hasBr) {
      // Walk childNodes in order, joining text runs with explicit "\\n" at
      // every <br>. Penpot's text engine respects "\\n" once text-content.ts
      // splits the joined value into paragraphs.
      const buf = [''];
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName ? child.tagName.toLowerCase() : '';
          if (tag === 'br') buf.push('');
        } else if (child.nodeType === Node.TEXT_NODE) {
          buf[buf.length - 1] += child.textContent || '';
        }
      }
      const joined = buf.map(normalizeLine).join('\\n');
      return joined.replace(/^\\s+|\\s+$/g, '').length > 0 ? joined : undefined;
    }

    const t = el.textContent || '';
    if (t.trim().length === 0) return undefined;
    return normalizeLine(t);
  }

  function walk(el, parentIndex) {
    const tag = el.tagName ? el.tagName.toLowerCase() : 'div';
    if (!tagRe.test(tag)) return;
    if (NON_RENDERABLE.indexOf(tag) !== -1) return;

    const r = el.getBoundingClientRect();
    // Skip elements that the browser laid out as zero-area (display:none,
    // visibility:collapse, empty inline flow, etc.). They have no visual
    // contribution and shouldn't materialise as Penpot shapes.
    if (r.width === 0 && r.height === 0) return;

    const rect = {
      x: r.left - minLeft,
      y: r.top - minTop,
      width: r.width,
      height: r.height,
    };

    const dataAttrs = pickDataAttrs(el);
    const inlineStyle = el.getAttribute('style') || '';
    const node = {
      index: nodes.length,
      parentIndex,
      childIndices: [],
      semanticTag: tag,
      rect,
      offsetWidth: el.offsetWidth || r.width,
      offsetHeight: el.offsetHeight || r.height,
      computedStyle: pickStyle(el),
      dataAttrs,
      inlineStyle,
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

    // Recurse only when this element has real element children (not just <br>
    // line breaks). <svg>/<img> are leaves. Elements with text + <br>-only are
    // captured as a single text leaf in getTextContent above.
    if (tag !== 'svg' && tag !== 'img' && !isLeafLikeForText(el)) {
      const orphans = orphanTextRuns(el);
      if (orphans) {
        const label = dataAttrs['data-name']
          ? \`"\${dataAttrs['data-name']}" (<\${tag}>)\`
          : \`<\${tag}>\`;
        const preview = orphans.map((s) => s.length > 32 ? s.slice(0, 29) + '…' : s).join(' / ');
        warnings.push(
          \`Text dropped from \${label}: "\${preview}". Wrap the text in its own element (e.g. <span>) so it isn't lost between sibling tags.\`,
        );
      }
      for (const child of Array.from(el.children)) walk(child, myIndex);
    }
  }

  for (const child of Array.from(inner.children)) walk(child, null);

  return { nodes, warnings, origin: { x: minLeft, y: minTop } };
})();
`.trim();
