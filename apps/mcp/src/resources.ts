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

const WRITE_GUIDE = `# Authoring HTML for create_design_from_html / update_selection_from_html

The HTML you pass is rendered in headless Chromium so the browser computes
exact layout. Stick to the CSS subset below — anything outside is silently
dropped or warned.

## Workflow

- "Create a design / build X"        -> create_design_from_html
- "Modify the selected header"       -> update_selection_from_html
   (replaces the subtree at the same position; the shape id changes)
- "Apply token / increase radius"    -> modify_shape (single mod-obj, fastest,
   preserves the id)
- "Apply token to fill"              -> apply_token (or modify_shape with
   ops.fill = { tokenName })
- "Register a design system"         -> create_token_set (replaces tokens-lib;
   pass every set you want to keep)
- "Use this hero.png"                -> upload_media first, then put
   data-penpot-media-id="<id>" on the <img> tag

## Supported CSS

- Box: width / height / padding (per-side), border-radius incl. per-corner,
  border (uniform width + solid/dashed/dotted), opacity, transform.
- Background: background-color, background-image with linear-gradient or
  radial-gradient (one solid + one gradient stack max). Raster images go
  through <img data-penpot-media-id>, NOT background-image:url(...).
- Box-shadow: comma list, each "<offX> <offY> <blur> <spread> <color>". A
  "0 0 0 Npx <color>" entry is interpreted as an OUTER stroke (use it
  deliberately).
- Layout containers: display:flex (with flex-direction, justify-content,
  align-items, gap, padding) and display:grid (grid-template-columns/rows
  with px/fr/auto/repeat). Children: flex:1 -> fill, explicit px -> fix,
  auto -> auto.
- Text: font-family, font-size, font-weight, font-style, line-height,
  letter-spacing, color, text-align. One run per element (no mixed-style
  spans yet).
- Tokens: var(--token-name, #fallback). Fallback is REQUIRED — the headless
  render needs it to compute the exact pixel size. The token name is
  recorded as an applied token on the shape so it stays live in Penpot.
- Semantic tags become Penpot frames / texts / images (the converter in
  reverse). <header> <section> <button> etc. become frames named after the
  tag (or after data-name="..." if you set it).

## Avoid

- position:fixed/sticky, ::before/::after, transitions/animations,
  clip-path, mask, display:table/inline-flex, mixed-style spans inside one
  text element.
- Top-level <style>/<script>/<head>/<title>/<meta>/<link> tags are filtered
  by the walker (they used to leak as 0×0 text shapes — they no longer do)
  but it's still cheaper to skip them.

## Tokens

\`create_token_set\` takes DTCG-style sets:

    sets: [{
      setName: "theme",
      tokens: [
        { name: "brand-primary", type: "color", value: "#2E51C4" },
        { name: "fg-on-brand",   type: "color", value: "#FFFFFF" },
      ],
    }]

After registering, reference from HTML as \`var(--brand-primary, #2E51C4)\` —
the builder reads the var name and emits applied-tokens for the right Penpot
slot (fill / strokeColor / r1..r4 / p1..p4 / gap / fontSize / etc.).

## Concurrency

Each write tool reads the current revn before sending update-file. If Penpot
rejects with a conflict, the tool returns "# update-file conflict" — recall
\`get_current_selection\` and try again, do NOT keep retrying with the stale
revn.
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
