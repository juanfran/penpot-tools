# html-to-penpot architecture

Inverse of `@penpot-tools/converter`: takes an HTML+CSS document, renders it in
headless Chromium to compute exact layout, and emits Penpot `update-file`
changes that recreate the same visual on the canvas.

For the high-level design rationale see [`MCP_WRITE_PLAN.md`](../../MCP_WRITE_PLAN.md)
at the repo root.

## Source layout

```
packages/html-to-penpot/src/
  index.ts                — htmlToChanges(html, ctx) → ChangeBundle
  types.ts                — MeasuredNode, BuildContext, ChangeBundle

  measure/
    walk.ts               — In-page DOM walker (string-injected into Chromium)
    headless.ts           — Playwright driver (singleton browser, mounts the doc)

  build/
    css.ts                — parsePx / parseNumber / parseColor
    selrect.ts            — selrect + points + identity matrix
    shape-id.ts           — UUID v4 generation
    text-content.ts       — DOM text leaf → Penpot rich-text content tree
    tree.ts               — MeasuredNode[] → Shape[]   (the hot path)

  visual/
    fills.ts              — solid + gradient stacked
    gradients.ts          — linear/radial CSS → Penpot Gradient
    strokes.ts            — uniform border + outer (box-shadow:0 0 0 Npx)
    shadows.ts            — multi box-shadow parser
    radius.ts             — per-corner

  layout/
    flex.ts               — flexLayoutFromComputed (display, dir, gap, padding, ...)
    grid.ts               — gridLayoutFromComputed (template-cols/rows, cells)
    layout-item.ts        — layoutItemFromComputed (fill / fix / auto sizing)

  tokens/
    extract.ts            — parse var(--name) in inline style → appliedTokens

  changes/
    builder.ts            — shapesToAddChanges + regObjectsChange
```

## Pipeline

```
HTML+CSS ──▶ headless Chromium ──▶ MeasuredNode[] ──▶ buildTree ──▶ Shape[]
                                                                       │
                                                          ┌────────────┴────────────┐
                                                          ▼                         ▼
                                                shapesToAddChanges          regObjectsChange
                                                          │                         │
                                                          └────────────┬────────────┘
                                                                       ▼
                                                                 FileChange[]
```

1. `measureHtml` mounts the HTML in a positioned `#penpot-inner` wrapper, waits
   for `document.fonts.ready` and `<img>` loads, then runs the `WALKER_SOURCE`
   string in-page. The walker collects one `MeasuredNode` per element with its
   `getBoundingClientRect()`-derived rect (already shifted so the bounding box
   sits at `(0, 0)`), a curated subset of `getComputedStyle(...)`, the inline
   `style` attribute string, and any `data-*` attributes.

2. `buildTree` allocates a UUID per node, picks the right Penpot shape type
   (frame / rect / text / image), extracts visual properties, applies layout
   fields when the node is a flex/grid container, applies layout-item sizing
   when its parent is, and detects `var(--token, fallback)` references in the
   inline `style` attribute. Children of flex containers are stored
   reverse-of-DOM-order to match Penpot's back-to-front Z-order convention
   (the converter reverses again on render — see "Flex child ordering" in
   the converter's CLAUDE.md).

3. `shapesToAddChanges` emits one `add-obj` per shape in document order
   (parents before children — required for Penpot to resolve `parentId` /
   `frameId`). A final `reg-objects` makes Penpot recompute the synthetic
   board's bounding box.

## Layer naming

Every shape's `name` is taken from `data-name="..."` if present, otherwise it
falls back to `node.semanticTag` (so a `<div>` becomes a layer literally named
"div", a `<section>` becomes "section", etc.). Image shapes fall back to
`"Image"` instead of the tag. The mapping happens in `build/tree.ts` for all
four shape branches (frame / image / text / rect). The walker preserves every
`data-*` attribute verbatim — no whitelist — so additional `data-*` fields are
free for downstream uses.

## Visual subset

| HTML / CSS                                     | Penpot                                         |
| ---------------------------------------------- | ---------------------------------------------- |
| `<header>/<section>/<button>/<div>` w/children | `frame`                                        |
| Leaf element with text                         | `text`                                         |
| Leaf element no text                           | `rect`                                         |
| `<img data-penpot-media-id="...">`             | `image` (media must be uploaded first)         |
| `display: flex`                                | `frame` with `layoutType: 'flex'` + flex props |
| `display: grid`                                | `frame` with `layoutType: 'grid'` + cells      |
| `background-color` / `background-image`        | solid fill / gradient fill (stacked)           |
| `border: Npx solid color` (uniform)            | stroke `inner`                                 |
| `box-shadow: 0 0 0 Npx color`                  | stroke `outer`                                 |
| `box-shadow` (otherwise)                       | shadow                                         |
| `border-radius` incl. per-corner               | `r1..r4`                                       |

## Token extraction

Computed style values lose `var(...)` references after browser resolution, so
we scan the **inline `style` attribute string** for each element. For every
declaration containing `var(--name[, fallback])`, the parser maps the CSS
property to the corresponding Penpot `appliedTokens` slot:

| CSS property                                        | Penpot slot(s)                  |
| --------------------------------------------------- | ------------------------------- |
| `background-color`, `background`                    | `fill`                          |
| `color`                                             | `fill` (text)                   |
| `border-color`, `border-top-color`                  | `strokeColor`                   |
| `border-radius`                                     | `r1`, `r2`, `r3`, `r4`          |
| `border-top-left-radius` (etc.)                    | `r1` (etc.)                     |
| `border-width`                                      | `strokeWidth`                   |
| `padding`                                           | `p1`, `p2`, `p3`, `p4`          |
| `padding-top` (etc.)                                | `p1` (etc.)                     |
| `gap`                                               | `rowGap`, `columnGap`           |
| `width` / `height` / `min-width` / etc.             | `width` / `height` / ...        |
| `font-size` / `font-family` / `line-height` / ...   | `fontSize` / `fontFamily` / ... |

The fallback in `var(--name, fallback)` is what the browser renders, so the
geometry we measure is correct even when the token isn't (yet) defined in the
file's tokens-lib.

## Penpot wire schema gotchas

- Field names on `update-file` use **camelCase** in JSON. The `:type` value is
  a kebab-case string (`'add-obj'`, `'mod-obj'`, `'reg-objects'`,
  `'set-tokens-lib'`).
- `update-file` requires `revn` AND `vern` in the request body — the OpenAPI
  TS types in `@penpot-tools/converter/types` only mention `revn`.
- `add-obj` is **singular**, not the `add-objects` plural in the OpenAPI types.
  Each change carries one shape under `obj` plus `pageId`/`parentId`/`frameId`.
- `layout-wrap-type` accepts `'wrap'` or `'nowrap'` (one word). The OpenAPI
  types claim `'no-wrap'` (with hyphen) — that's wrong.
- `set-tokens-lib` accepts a DTCG payload with `$type`/`$value` keys, but
  ONLY via `Content-Type: application/transit+json`. Penpot's regular JSON
  decoder strips `$` from object keys, so plain JSON silently corrupts the
  payload. See `apps/mcp/src/transit.ts` for the minimal Transit encoder.
- Required feature flags on every read/write: `design-tokens/v1`, `variants/v1`,
  `components/v2`, `styles/v2`, `fdata/objects-map`, `fdata/path-data`,
  `fdata/shape-data-type`, `layout/grid`, `plugins/runtime`. Missing one
  returns a 400 `:feature-not-supported` error.

## Adding a new visual property

1. Pick the matching Penpot field on `Shape` (or one of the shape subtypes).
2. Add a reader in `visual/<area>.ts` that takes a `PickedComputedStyle` (or a
   subset) and returns the Penpot value (or `undefined` if not present).
3. Spread the result into the appropriate shape constructor in `build/tree.ts`.
4. If the property can be tokenised (e.g. it has a CSS custom property variant),
   add the CSS property → Penpot slot mapping in `tokens/extract.ts:PROPERTY_MAP`.
5. Add a unit test in `<area>.test.ts` and, if the change is non-trivial, a
   smoke against the live Penpot file (`apps/mcp/scripts/smoke-write-real-*.mts`).

## Adding a new shape type

1. Detect the new node shape in `build/tree.ts` (e.g. an `<svg>` outer HTML or
   an attribute hint).
2. Build the shape inside `tree.ts` — keep the existing layout-item /
   appliedTokens spreads. Don't extract a new file unless the constructor is
   non-trivial.
3. The `MeasuredNode` already captures `svgOuter`, `imageMediaId`, etc. — add a
   field if you need more than what the walker collects today.
