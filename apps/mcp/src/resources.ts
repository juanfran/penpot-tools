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

The HTML is rendered in headless Chromium and snapshotted: whatever the
browser computes (geometry, fills, fonts) becomes Penpot shapes. Anything
outside the subset below is dropped silently — there is no fallback render.

## Pick the right tool

| User intent                       | Tool                          |
| --------------------------------- | ----------------------------- |
| "Create / build / design X"       | create_design_from_html       |
| "Modify the selected header"      | update_selection_from_html    |
| "Apply token / change radius"     | modify_shape                  |
| "Apply this color token"          | apply_token                   |
| "Register a design system"        | create_token_set              |
| "Use hero.png"                    | upload_media → <img data-penpot-media-id="…"> |

## Layer names — ALWAYS set data-name

Every element becomes a Penpot layer. Without \`data-name\`, the layer is
named after the tag (\`div\`, \`section\`, …), which is useless in the outline.
Set \`data-name="Hero title"\`, \`data-name="CTA"\`, etc. on every element.

## Composition

- **Stacked content (vertical sections, button rows):** use \`display:flex\`
  with \`flex-direction\`, \`gap\`, \`padding\`, \`justify-content\`, \`align-items\`.
  Or \`display:grid\` with \`grid-template-columns/rows\` (px/fr/auto/repeat).
- **Editorial / overlapping layouts:** wrap in a \`position:relative\` parent
  and place children with \`position:absolute; left:Npx; top:Npx;\`. Browser
  computes exact pixels, Penpot stores them — no further care needed.
- **Z-order = DOM order.** Later siblings paint on top. Move a chip or badge
  later in the markup if you want it in front.
- **Rotation:** only \`transform: rotate(<deg>)\` is honoured (around the
  element's centre). Scale, skew, 3D, and \`transform-origin\` are dropped.
- **Avoid:** \`position:fixed/sticky\`, \`::before/::after\`, transitions,
  \`clip-path\`, \`mask\`, mixed-style spans in one text element.

## Style cheatsheet

| Works                                                       | Don't bother                          |
| ----------------------------------------------------------- | ------------------------------------- |
| width / height / padding (per side)                         | margin (compose with flex gap)        |
| border-radius incl. per-corner                              | outline                               |
| border: Npx <solid|dashed|dotted> color (uniform)           | per-side border-color/style           |
| opacity, color (any \`rgb\`/\`rgba\`/\`#hex\`)                 | currentColor                          |
| background-color                                            | background-clip, background-origin    |
| background-image: linear-gradient / radial-gradient         | conic-gradient, multiple bgs > 1+1    |
| rgba alpha **inside** gradient stops                        | —                                     |
| box-shadow list (\`offX offY blur spread color\`)             | inset shadows                         |
| \`box-shadow: 0 0 0 Npx color\` ⇒ outer stroke               | —                                     |
| font-family / size / weight / style / line-height           | font-variant, font-feature-settings   |
| letter-spacing (any unit), text-align                       | text-decoration colour                |
| transform: rotate(Ndeg)                                     | scale, skew, matrix(), 3D             |
| display: flex / grid                                        | display: table, inline-flex           |

## Recipes

**Chip / pill (text with background + padding)**
\`\`\`html
<div data-name="Chip" style="display:inline-block; padding:6px 14px;
     border-radius:99px; background:#1A1A1A; color:#FFF;
     font-size:12px; font-weight:600;">NEW</div>
\`\`\`
The text shape carries the background fill — no wrapper needed.

**Badge that sits over an image**
Place the image first, then the badge later in the DOM (so it paints on top):
\`\`\`html
<div style="position:relative; width:420px; height:340px;">
  <img data-name="Hero" src="…" data-penpot-media-id="…" style="width:100%; height:100%;">
  <div data-name="New badge" style="position:absolute; right:-16px; top:-16px;
       width:72px; height:72px; border-radius:50%; background:#C8553D;
       color:#FFF; display:flex; align-items:center; justify-content:center;">NEW</div>
</div>
\`\`\`

**Rotated stamp**
\`\`\`html
<div data-name="Sold tag" style="position:absolute; left:24px; top:120px;
     transform:rotate(-6deg); padding:6px 12px; background:#F5F1EA;
     font-size:11px; font-weight:700; letter-spacing:3px;">SOLD</div>
\`\`\`

**Photo darken-overlay (gradient with alpha)**
\`\`\`html
<div data-name="Photo shade" style="position:absolute; left:0; bottom:0;
     width:100%; height:40%;
     background:linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 100%);"></div>
\`\`\`
Alpha is preserved per stop. 0.35 is barely visible — use ≥0.5 for a useful shadow.

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
REQUIRED — the headless render needs it to compute exact pixels. The token
name is recorded as an applied token on the shape so it stays live.

## Concurrency

Each write tool reads the current \`revn\` before sending. On conflict the
tool returns \`# update-file conflict\` — recall \`get_current_selection\` and
retry with the fresh revn, never with the stale one.
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
