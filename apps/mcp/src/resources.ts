import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Long-form guides that used to live in `SERVER_INSTRUCTIONS`. The instructions
 * block is loaded into the system prompt of every conversation, so we keep it
 * tiny and put framework-conversion / write-mode / wire-format detail behind
 * MCP resources the model can fetch on demand.
 */

const CONVERT_GUIDE = `# Converting Penpot HTML to your target framework

The HTML returned by \`get_*_html\` tools is intentionally low-level: a <div>
tree with inline \`style="..."\`, \`var(--token, fallback)\` for design tokens,
and \`@font-face\` for web fonts (in the \`fontsCss\` field).

Do NOT paste it verbatim. Always:

1. Detect the target. Look at file extension, package.json, surrounding code.
   - .tsx / React           -> JSX with className
   - .vue                   -> <template> with class=
   - .html / .astro / etc.  -> semantic HTML
   - tailwind.config        -> Tailwind utility classes; inline only when no
                               utility exists (custom transforms, exact px
                               offsets the design depends on)
   - shadcn / ui kit        -> map common patterns (button, input, card) to
                               the kit's components when the visual matches

2. Replace generic <div>s with semantic tags: <header>, <nav>, <main>,
   <section>, <article>, <aside>, <footer>, <h1>..<h6>, <p>, <ul>/<li>,
   <button>, <a>, <input>, <label>, <form>. Strip wrapper divs that only
   exist for grouping in the designer (type "frame"/"group" with no styling
   beyond layout).

3. Preserve layout intent (flex, grid, spacing) but express it idiomatically
   for the target.

4. Keep design tokens. Port the \`tokensCss\` :root block into a globals
   stylesheet and reference \`var(--token-name)\` (or the Tailwind theme
   equivalent). Do not inline raw hex values when a token name is available.

5. Drop unnecessary positioning. The converter emits position:absolute /
   translate(...) because Penpot is canvas-based. In production code, prefer
   normal flow + flex/grid; only keep absolute positioning when a visual
   overlap requires it.

6. For images, replace <img src="..."> with the project's preferred
   mechanism (local asset, next/image, etc.). The Penpot URL is included so
   you can download the asset.

When implementing or reworking a design, pair \`get_screenshot\` with
\`get_current_html\`. The screenshot tells you visual hierarchy (what is a
button vs a badge vs a card, where icons go); the HTML tells you the exact
tokens, fonts, sizes, structure.
`;

const WRITE_GUIDE = `# Authoring HTML for the write-mode tools

Headless Chromium renders your HTML; the resulting geometry / fills / fonts /
shadows become Penpot shapes. Anything the converter can't translate is
dropped, and **every drop is reported in the tool response under
\`## Warnings\`**. Always scan that list before declaring the design done —
it's where you catch silent degradations (filters, blend modes, unparseable
shadows, missing media ids, scale/skew transforms, occluded layers, …).

## Pick the right tool

| Intent                            | Tool                                              |
| --------------------------------- | ------------------------------------------------- |
| "Create / build / design X"       | create_design_from_html                           |
| "Modify the selected header"      | update_selection_from_html                        |
| "Change a single attribute"       | modify_shape                                      |
| "Apply this color token"          | apply_token                                       |
| "Register a design system"        | create_token_set                                  |
| "Use hero.png"                    | upload_media → \`<img data-penpot-media-id="…">\` |

## What you send

- Send a fragment, not a full document — \`<!DOCTYPE>\`, \`<html>\`, \`<body>\`
  are auto-stripped. Your single root element becomes the board's contents.
- Set \`data-name="…"\` on **every** element. Without it, layers are named
  after the tag (\`div\`, \`section\`, …) and the Penpot outline is unusable.

## Composition

- **Stacked rows / columns:** \`display:flex\` (\`flex-direction\`, \`gap\`,
  \`padding\`, \`justify-content\`, \`align-items\`) or \`display:grid\`
  (\`grid-template-columns/rows\`: px / fr / auto / repeat).
- **Editorial / overlapping:** \`position:relative\` parent + \`position:absolute;
  left:N; top:N;\` children. \`right:\` and \`bottom:\` work too — they anchor
  to the nearest positioned ancestor (the parent if it's \`position:relative\`).
- **Z-order = DOM order.** Later siblings paint on top of earlier ones. If
  layer A should appear on top of layer B, put A AFTER B in the DOM.
- **Rotation:** \`transform: rotate(<deg>)\` rotates around the element centre.

## What works, what's dropped

| Property                                            | Status                              |
| --------------------------------------------------- | ----------------------------------- |
| width / height / padding (per-side)                 | ✓                                   |
| margin                                              | drop — use flex \`gap\`               |
| border-radius — px or % (e.g. \`50%\` → circle)       | ✓ (% resolves against min(w, h))    |
| \`border: Npx <solid\\|dashed\\|dotted> color\`         | uniform only — top side wins        |
| opacity, color (rgb / rgba / #hex)                  | ✓                                   |
| background: solid / linear-gradient / radial-gradient | ✓ (alpha in stops works)          |
| conic-gradient, image \`url()\`, multiple bgs         | drop                                |
| box-shadow (drop, inset, negative spread, multi)    | ✓                                   |
| box-shadow \`0 0 0 Npx color\`                        | ✓ — emitted as outer stroke         |
| font: family / size / weight / style / line-height  | ✓                                   |
| letter-spacing, text-align                          | ✓                                   |
| transform: rotate                                   | ✓                                   |
| scale / skew / matrix / 3D / transform-origin       | drop                                |
| display: flex / grid (incl. inline variants)        | ✓                                   |
| position: fixed / sticky                            | drop (rendered as static)           |
| filter, mix-blend-mode, clip-path, mask, outline    | drop                                |
| \`::before\` / \`::after\`, transitions, animations    | drop                                |
| currentColor, text-decoration colour                | drop                                |

## Recipes

**Chip / pill / button** — a leaf with text PLUS box visuals (\`background\` /
\`border\` / \`box-shadow\`) is auto-split into a frame (carrying the visuals)
plus a child text shape positioned at the inner content-box. So this is one
authored element but two layers in Penpot:

\`\`\`html
<div data-name="Chip" style="padding:6px 14px; border-radius:99px;
     background:#1A1A1A; color:#FFF; font-size:12px; font-weight:600;">NEW</div>
\`\`\`

**Circular icon button** — \`border-radius:50%\` resolves to half the smaller
side. The chip auto-split applies as well:

\`\`\`html
<div data-name="Save" style="width:46px; height:46px; border-radius:50%;
     background:#000; color:#FFF; font-size:20px;
     display:flex; align-items:center; justify-content:center;">+</div>
\`\`\`

**Badge over an image** — paint order = DOM order, so the badge follows the
image:

\`\`\`html
<div style="position:relative; width:420px; height:340px;">
  <img data-name="Hero" data-penpot-media-id="…" style="width:100%; height:100%;">
  <div data-name="New badge" style="position:absolute; right:-16px; top:-16px;
       width:72px; height:72px; border-radius:50%; background:#C8553D;
       color:#FFF; display:flex; align-items:center; justify-content:center;">NEW</div>
</div>
\`\`\`

**Rotated stamp:**

\`\`\`html
<div data-name="Sold tag" style="position:absolute; left:24px; top:120px;
     transform:rotate(-6deg); padding:6px 12px; background:#F5F1EA;
     font-size:11px; font-weight:700; letter-spacing:3px;">SOLD</div>
\`\`\`

**Soft floating shadow** (negative spread keeps it contained):

\`\`\`html
<div data-name="Card" style="…; box-shadow:0 30px 60px -20px rgba(0,0,0,0.35);">
\`\`\`

**Photo darken overlay** — alpha in gradient stops; ≥0.5 for noticeable. The
overlay is semi-transparent so it does NOT trigger an occlusion warning:

\`\`\`html
<div data-name="Shade" style="position:absolute; left:0; bottom:0;
     width:100%; height:40%;
     background:linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 100%);"></div>
\`\`\`

## Gotchas

- **Mixed text + element children loses prose.** \`<p>Hello <span>x</span></p>\`
  drops "Hello ". Wrap every text run in its own element (\`<span>\` is fine).
  Reported as a warning when it happens.
- **Multi-paragraph text** (\`<br>\`, multiple \`<p>\`) is not supported. One
  element per line.
- **Padding only shows when the element has a background, border, or shadow.**
  Otherwise the gap is invisible — use flex \`gap\` instead.
- **Per-side borders collapse to the top side.** For a single-side rule,
  build it as a 1-px rect.
- **Sizing in tight flex rows.** When a row's natural content overflows the
  container, Chrome's flex shrinks every child including thin separators
  (\`width:1px\`). Authored \`width:Npx\` on a leaf is restored if flex shrunk
  it below N — but if you want a column to keep its intrinsic width, leave
  more room or set \`flex-shrink:0\`.
- **Silent occlusion is reported.** If you place a small layer (e.g. a price
  chip on a photo) and a later, larger element with an opaque fill lands on
  top of it, that layer is invisible. The tool reports each fully-covered
  shape under \`## Warnings\` — reorder the DOM (move the small layer to come
  AFTER the occluder) or shift the occluder.

## Tokens

\`create_token_set\` takes DTCG sets:

\`\`\`js
sets: [{
  setName: "theme",
  tokens: [
    { name: "brand-primary", type: "color", value: "#2E51C4" },
    { name: "fg-on-brand",   type: "color", value: "#FFFFFF" },
  ],
}]
\`\`\`

Reference in HTML as \`var(--brand-primary, #2E51C4)\`. The fallback is
**required** — the headless render uses it to compute exact pixels. The
token name is recorded as an applied token on the shape so it stays live.

## Concurrency

Each write tool reads the current \`revn\` before sending. On conflict the
tool returns \`# update-file conflict\` — call \`get_current_selection\` and
retry with the fresh revn, never the stale one.
`;

export function registerGuideResources(
  server: McpServer,
  options: { writable: boolean },
): void {
  server.registerResource(
    'convert-guide',
    'penpot://convert-guide',
    {
      title: 'How to convert Penpot HTML to a target framework',
      description:
        'Long-form guidance for read-mode tools: framework detection, semantic-tag mapping, token porting, image handling. Fetch this when the user asks "convert this design to React/Vue/Tailwind" or similar.',
      mimeType: 'text/markdown',
    },
    async () => ({
      contents: [
        {
          uri: 'penpot://convert-guide',
          mimeType: 'text/markdown',
          text: CONVERT_GUIDE,
        },
      ],
    }),
  );

  if (!options.writable) return;

  server.registerResource(
    'write-guide',
    'penpot://write-guide',
    {
      title: 'How to author HTML for write-mode tools',
      description:
        'Long-form guidance for write-mode tools: supported CSS subset, token authoring, workflow per intent, concurrency. Fetch this before authoring HTML for create_design_from_html / update_selection_from_html when unsure what is supported.',
      mimeType: 'text/markdown',
    },
    async () => ({
      contents: [
        {
          uri: 'penpot://write-guide',
          mimeType: 'text/markdown',
          text: WRITE_GUIDE,
        },
      ],
    }),
  );
}
