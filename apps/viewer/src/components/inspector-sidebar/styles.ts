export interface StyleDeclaration {
  prop: string;
  value: string;
}

export function parseStyleDecls(styleAttr: string): StyleDeclaration[] {
  return styleAttr
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((decl) => {
      const idx = decl.indexOf(':');
      if (idx === -1) return null;
      return { prop: decl.slice(0, idx).trim(), value: decl.slice(idx + 1).trim() };
    })
    .filter((d): d is StyleDeclaration => d !== null);
}

export interface ExtractedText {
  html: string;
  plain: string;
}

export function extractText(html: string, shapeId: string): ExtractedText | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const el = doc.querySelector(`[data-id="${shapeId}"][data-type="text"]`);
  if (!el) return null;
  const plain = Array.from(el.querySelectorAll('p'))
    .map((p) => p.textContent ?? '')
    .join('\n');
  return { html: el.innerHTML, plain };
}

export function extractStyles(html: string, shapeId: string): StyleDeclaration[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  let el = doc.querySelector(`[data-id="${shapeId}"]`) as HTMLElement | null;
  if (!el) return [];

  let decls = parseStyleDecls(el.getAttribute('style') ?? '');
  const meaningful = decls.filter(({ prop }) => prop !== 'width' && prop !== 'height');

  // If root only has sizing (flex-child wrapper pattern), use first child's styles
  if (meaningful.length === 0 && el.children.length === 1) {
    el = el.firstElementChild as HTMLElement;
    decls = parseStyleDecls(el?.getAttribute('style') ?? '');
  }

  const rootDecls = decls.filter(({ prop }) => prop !== 'width' && prop !== 'height');

  // Text shapes: typography lives on <p> elements, not the root div
  const isText = el.getAttribute('data-type') === 'text';
  const firstP = isText ? el.querySelector('p') : null;
  const paraDecls = firstP
    ? parseStyleDecls(firstP.getAttribute('style') ?? '').filter(
        ({ prop }) => prop !== 'width' && prop !== 'height',
      )
    : [];

  return [...rootDecls, ...paraDecls];
}

// Groups properties into display sections for readability
const SECTION_ORDER: Array<{ label: string; prefixes: string[] }> = [
  {
    label: 'Position',
    prefixes: ['position', 'top', 'left', 'right', 'bottom', 'z-index', 'transform'],
  },
  {
    label: 'Layout',
    prefixes: [
      'display',
      'flex',
      'align',
      'justify',
      'gap',
      'grid',
      'padding',
      'margin',
      'flex-direction',
      'flex-wrap',
      'align-items',
      'align-content',
      'justify-content',
    ],
  },
  {
    label: 'Visual',
    prefixes: [
      'background',
      'border',
      'box-shadow',
      'opacity',
      'filter',
      'backdrop-filter',
      'mix-blend-mode',
      'overflow',
      'visibility',
      'color',
    ],
  },
  {
    label: 'Typography',
    prefixes: ['font', 'line-height', 'letter-spacing', 'text', 'white-space', 'word'],
  },
];

export interface StyleSection<T extends StyleDeclaration = StyleDeclaration> {
  label: string;
  decls: T[];
}

export function groupStyles<T extends StyleDeclaration>(decls: T[]): StyleSection<T>[] {
  const assigned = new Set<number>();
  const sections: StyleSection<T>[] = [];

  for (const section of SECTION_ORDER) {
    const matched = decls
      .map((d, i) => ({ d, i }))
      .filter(({ d, i }) => !assigned.has(i) && section.prefixes.some((p) => d.prop.startsWith(p)));
    if (matched.length > 0) {
      matched.forEach(({ i }) => assigned.add(i));
      sections.push({ label: section.label, decls: matched.map(({ d }) => d) });
    }
  }

  const rest = decls.filter((_, i) => !assigned.has(i));
  if (rest.length > 0) {
    sections.push({ label: 'Other', decls: rest });
  }

  return sections;
}
