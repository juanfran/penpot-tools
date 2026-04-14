# CLAUDE.md

## What this project does

Converts Penpot design files (JSON) into Tailwind CSS HTML. Given a Penpot page or shape object, it emits a `<div>` tree with Tailwind classes that faithfully reproduces the visual design.

## Monorepo structure

```
penpot-random/              # workspace root
  package.json              # root scripts: test, lint, check, penpot-to-html
  pnpm-workspace.yaml
  packages/
    converter/              # @penpot-random/converter
      package.json
      tsconfig.json
      cache/                # gitignored; raw API responses
      scripts/              # dev scripts (add-test-case, inspect-shape)
      src/                  # all source and tests
```

## Commands

All commands run from the **workspace root** unless noted otherwise.

```bash
pnpm test                   # run all tests (vitest, all packages)
pnpm test -- --run          # run once, no watch
pnpm lint                   # oxlint
pnpm check                  # oxlint --fix + oxfmt
pnpm penpot-to-html --file-id <uuid> [--page-id <uuid>] [--shape-id <uuid>] [--output <path>] [--cache]
```

Auth for `penpot-to-html`: set `PENPOT_TOKEN`, or both `PENPOT_EMAIL` + `PENPOT_PASSWORD`.  
`--cache` reads/writes `packages/converter/cache/<file-id>.json` to avoid re-fetching.

## Source layout

```
packages/converter/src/
  penpot.types.ts          # All Penpot API types (Page, Shape, FrameShape, …)
  penpot-to-html.ts        # CLI entry point

  converter/
    index.ts               # Public API: convertPage(), convertShape()
    render.ts              # renderShape() — wraps dispatch, adds data-penpot-* attrs
    page.ts                # renderPage() — iterates root frame children
    tree.ts                # getChildren() — resolves shape.shapes[] into Shape[]
    types.ts               # ConverterContext, ConvertResult, FontInfo
    tokens.ts              # extractTokens(), tokensToCss() — design token → CSS var

    shapes/
      dispatch.ts          # switch(shape.type) → calls the right renderer
      frame.ts             # <div> for frames (flex / grid / plain container)
      rect.ts              # <div> for rectangles
      circle.ts            # <div> for circles and ellipses
      group.ts             # <div> for groups
      text.ts              # <p>/<span> tree for text shapes
      image.ts             # <img> for images
      path.ts              # <svg><path> for paths
      bool.ts              # <svg><path> for boolean shapes
      svg-raw.ts           # passthrough for raw SVG shapes

    visual/
      base.ts              # opacity, blend-mode, hidden, blur, shadow, radius
      fills.ts             # bg-[color] / gradient inline style
      strokes.ts           # border-* (inner/center) or box-shadow (outer)
      shadows.ts           # box-shadow from shadow[]
      radius.ts            # rounded-* from r1/r2/r3/r4 or uniform radius
      blur.ts              # backdrop-blur / blur
      blend.ts             # mix-blend-mode, opacity, visibility
      position.ts          # absolute / relative / translate positioning

    layout/
      flex.ts              # flex container classes + gap/padding
      grid.ts              # grid-template-columns/rows, gridCellClasses
      layout-item.ts       # sizing, margin, align-self for flex/grid children

    utils/
      html.ts              # tag() builder, escapeHtml()
      tailwind.ts          # cls(), pxClass()
      style.ts             # mergeStyles(), buildStyle()
      color.ts             # hexOpacityToCss()
      transform.ts         # matrixToCss(), isIdentityMatrix()

  intengration/            # Integration tests (note the typo — keep it)
    integration.test.ts
    utils.ts               # getPage(name), getExpected(name)
    *.json                 # Input Penpot page JSON
    *.expected.html        # Expected HTML output
```

## Key conventions

### ConverterContext flags

Internal flags passed down the render tree — never set by callers:

| Flag                | Meaning                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `_parentIsLayout`   | Parent is a flex/grid container; child emits `w-full h-full` instead of absolute position |
| `_forceRelative`    | Emit `relative w-[N] h-[N]` instead of absolute (used for grid children and export root)  |
| `_isCanvasTopLevel` | Shape is a direct child of the root frame; use `translate()` instead of `top/left`        |
| `_isChildOfRoot`    | Enables `fixed` for shapes with `fixedScroll`                                             |
| `_offsetX/_offsetY` | Parent's page-absolute position; used to compute relative `top`/`left`                    |
| `_pageBackground`   | Background color applied only to the root frame                                           |
| `_fontCollector`    | Map populated by text renderers; extracted as `FontInfo[]` at the end                     |
| `tokens`            | `Map<tokenName, cssColor>` for design token → CSS variable substitution                   |

### Shape positioning rules (`resolvePositionOutput` in `visual/position.ts`)

Priority order (highest first):

1. `_parentIsLayout` → `w-full h-full` (fills the wrapper div emitted by the parent layout)
2. `_forceRelative` → `relative w-[N] h-[N]`
3. `_isCanvasTopLevel` → `absolute top-[0] left-[0] w-[N] h-[N]` + `transform: translate(x,y)`
4. default → `absolute left-[N] top-[N] w-[N] h-[N]`

**Exception**: text shapes (`renderText`) skip `posOut.classes` when `_parentIsLayout` is set — they emit their own `sizeClasses` (`w-[N] h-[N]`) directly and don't need `w-full h-full`.

### Frame rendering (`shapes/frame.ts`)

- **Root frame** (`parentId === id`): `relative w h`, no positioning. Never rendered directly — `convertShape` renders its children instead.
- **Flex frame**: `flex` + `flexContainerClasses` + `flexSpacingClasses` (gap + padding). Children get sizing wrapper divs via `layoutItemSizingClasses`; the child shape fills the wrapper with `w-full h-full`.
- **Grid frame**: `grid` + `gridTracksToClass` + `flexSpacingClasses` (gap + padding reused). Children rendered with `_forceRelative: true`; each wrapped in a cell div with `gridCellClasses`.
- **Plain frame**: children rendered with absolute positioning offset by the frame's `x/y`.
- `clipContent !== false` → `overflow-hidden` (absent property treated as true — Penpot clips by default).
- Strokes applied from `shape.strokes[0]`: inner/center → `border-*` Tailwind classes; outer → `shadow-[...]` Tailwind class.

### Flex `shapes[]` child ordering and reverse directions

Penpot stores flex children in `shapes[]` in **Z-order (back-to-front)** — `shapes[0]` is the frontmost layer (highest z-index). This ordering is opposite to CSS flex DOM order for `row` and `column`:

| Penpot `layoutFlexDir` | `shapes[]` order | CSS class emitted | DOM rendering                       |
| ---------------------- | ---------------- | ----------------- | ----------------------------------- |
| `row`                  | rightmost first  | `flex-row`        | reverse `shapes[]` before rendering |
| `column`               | bottommost first | `flex-col`        | reverse `shapes[]` before rendering |
| `row-reverse`          | leftmost first   | `flex-row`        | use `shapes[]` order as-is          |
| `column-reverse`       | topmost first    | `flex-col`        | use `shapes[]` order as-is          |

**Key insight:** `row-reverse` and `column-reverse` in Penpot do **not** map to CSS `flex-row-reverse`/`flex-col-reverse`. Penpot's "reverse" flips the z-ordering of children (so the leftmost/topmost item is now frontmost), but the visual flex direction is still left-to-right / top-to-bottom. Using CSS `flex-row-reverse` would push items to the wrong side.

This is implemented in `shapes/frame.ts`: the reversal of `children` is skipped when `layoutFlexDir` is `row-reverse` or `column-reverse`, and `flex.ts` maps both reverse variants to their non-reverse CSS equivalents.

### Flex child sizing pattern

Children inside a flex container are rendered with a two-element pattern:

```html
<!-- wrapper div carries the layout-item sizing -->
<div class="h-[50px] w-[240px]">
  <!-- child fills the wrapper -->
  <div class="flex h-full w-full flex-row ...">...</div>
</div>
```

- `layoutItemSizingClasses(child, parent)` computes the wrapper classes:
  - `fill` → `flex-1` (main axis) or `w-full`/`h-full` (cross axis)
  - `fix` or **undefined** → explicit `w-[Npx] h-[Hpx]` (undefined treated as fix — Penpot default)
  - `auto` → no class
- The wrapper div is omitted when `itemClasses` is empty (no sizing, no margin, etc.).
- The child's `resolvePositionOutput` with `_parentIsLayout: true` returns `w-full h-full`.

### Stroke alignment

| Penpot alignment   | CSS output                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `inner` / `center` | `border-[Npx] border-[color] border-solid` (Tailwind; with `box-sizing: border-box` this stays inside the element's dimensions) |
| `outer`            | `shadow-[0_0_0_Npx_color]` Tailwind class                                                                                       |

### Design token system

Penpot shapes may carry an `appliedTokens` map linking CSS properties to token names. These are rendered as CSS custom properties:

```html
<style>
  :root {
    --accent: #2e51c4;
    --fg: #000000;
    --fg-light: #ffffff;
  }
</style>
```

**How it works:**

1. `extractTokens(objects)` in `packages/converter/src/converter/tokens.ts` scans all shapes for `appliedTokens` and resolves each token name to a CSS color (from the shape's own fills/strokes).
2. `ConverterContext.tokens` carries the `Map<tokenName, cssColor>` through the render tree.
3. Visual functions accept an optional token name and emit `var(--token)` instead of a raw hex:
   - `fillsToOutput(fills, ctx, fillTokenName?)` → `bg-[var(--TOKEN)]`
   - `solidStrokeToClasses(stroke, strokeTokenName?)` → `shadow-[0_0_0_Npx_var(--TOKEN)]` or `border-[var(--TOKEN)]`
   - `textLeafColorClass(leaf, fillTokenName?)` → `text-[var(--TOKEN)]`
4. Each renderer reads `shape.appliedTokens?.fill` and `shape.appliedTokens?.strokeColor` and passes them to the visual functions.
5. `tokensToCss(tokens)` generates the `:root { ... }` block injected into the `<style>` tag in `penpot-to-html.ts`.

**When adding a new renderer**, always forward `shape.appliedTokens?.fill` to `fillsToOutput` and `shape.appliedTokens?.strokeColor` to stroke functions.

### `mergeStyles()` special behaviour

Concatenates style strings but **merges multiple `box-shadow` declarations** into a single comma-separated value so drop-shadows and outer strokes coexist.  
Each argument must be a single CSS declaration (`property: value;`), not a block.

### Circle / ellipse

- `width === height` → `rounded-full`
- `width !== height` → `rounded-[50%]`

No inline `border-radius` style should ever appear.

## Tailwind-first output rule

**All visual properties must be expressed as Tailwind classes. Inline `style=` is only allowed when no Tailwind equivalent exists.**

Allowed inline styles:

- `transform: translate(x, y)` — canvas-top-level elements (no Tailwind class for arbitrary translate on positioned elements)
- `border-radius: top-left top-right bottom-right bottom-left` — non-uniform corner radii (four different values)
- `padding: p1 p2 p3 p4` — non-symmetric padding (all four sides different)
- `margin: m1 m2 m3 m4` — non-symmetric margins (all four sides different)

Everything else must use Tailwind arbitrary-value classes:

| Property                  | Inline style ❌                          | Tailwind class ✓         |
| ------------------------- | ---------------------------------------- | ------------------------ |
| `box-shadow`              | `style="box-shadow: 4px 4px #000"`       | `shadow-[4px_4px_#000]`  |
| `grid-template-columns`   | `style="grid-template-columns: 1fr 2fr"` | `grid-cols-[1fr_2fr]`    |
| `grid-template-rows`      | `style="grid-template-rows: 100px auto"` | `grid-rows-[100px_auto]` |
| `border-radius` (uniform) | `style="border-radius: 50%"`             | `rounded-[50%]`          |

### Arbitrary value encoding

In Tailwind arbitrary values, **spaces become underscores** and the value goes inside `[...]`:

- `4px 4px 4px 10px rgba(255, 0, 0, 0.2)` → `shadow-[4px_4px_4px_10px_rgba(255,_0,_0,_0.2)]`
- `1fr 1fr 1fr` → `grid-cols-[1fr_1fr_1fr]` or `grid-rows-[1fr_1fr_1fr]`

### Multiple `shadow-[...]` classes

`cls()` automatically merges multiple `shadow-[...]` classes into one comma-separated value so that drop-shadows and outer strokes coexist:

```ts
cls('shadow-[2px_2px_#000]', 'shadow-[0_0_0_2px_red]');
// → 'shadow-[2px_2px_#000,0_0_0_2px_red]'
```

## Generating HTML from a Penpot board URL

When the user gives you fileId, pageId or shapeId, run this script (from the workspace root):

```bash
pnpm penpot-to-html \
  --file-id 0075361e-ccf8-8015-8007-dd63b3a9bb7d \
  --page-id 0075361e-ccf8-8015-8007-dd63b3a9bb7e \
  --shape-id 4c914ab1-c8d2-80ae-8007-dd653415ab49 \
  --output output.html \
  --cache
```

The `--cache` flag saves the fetched page to `packages/converter/cache/<file-id>.json` so subsequent runs don't re-fetch.
Omit `--shape-id` to render the entire page.

You can also pass the full workspace URL directly:

```bash
pnpm penpot-to-html --url "https://design.penpot.app/#/workspace?file-id=...&page-id=..." --shape-id <board-id>
```

## Adding a new integration test

### From a real Penpot board (recommended)

**Step 1** — fetch and cache the page (from workspace root):

```bash
pnpm penpot-to-html --file-id <uuid> --page-id <uuid> --cache
```

**Step 2** — create the test case files automatically (run from `packages/converter/`):

```bash
cd packages/converter
pnpm exec tsx scripts/add-test-case.mts --name <test-name> --file-id <uuid> --board-id <uuid>
```

This script:

1. Reads `packages/converter/cache/<file-id>.json`
2. Copies it to `packages/converter/src/intengration/<name>.json`
3. Runs `convertShape` on the board shape
4. Writes `packages/converter/src/intengration/<name>.expected.html`
5. Prints the test case snippet to add in `integration.test.ts`

**Step 3** — add the printed test case to `packages/converter/src/intengration/integration.test.ts`.

### Manually (for hand-crafted JSON)

1. Place the Penpot page JSON in `packages/converter/src/intengration/<name>.json`.
2. Regenerate the expected HTML (from `packages/converter/`):
   ```bash
   cd packages/converter
   pnpm exec tsx scripts/add-test-case.mts --name <name> --file-id <file-id-matching-cache> --board-id <shape-id>
   ```
   Or if the JSON is already in place, edit and re-run to overwrite only the `.expected.html`.
3. Add a test case in `packages/converter/src/intengration/integration.test.ts` following the existing pattern.

### Regenerating expected HTML after intentional output changes

Re-run the add-test-case script — do not hand-edit `.expected.html` files.

## Test fixture files

Integration test fixtures live in `packages/converter/src/intengration/`:

| File                   | Purpose                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `<name>.json`          | Full Penpot page JSON (same shape as the API `get-page` response) |
| `<name>.expected.html` | Expected converter output for the target shape                    |

Cached raw API responses live in `packages/converter/cache/<file-id>.json` — these are gitignored and used only as a source when creating new test cases.

## Cache JSON structure

`packages/converter/cache/<file-id>.json` is a **flat** Penpot page object:

```json
{
  "id": "<page-uuid>",
  "name": "Page 1",
  "objects": {
    "<shape-uuid>": {
      /* Shape */
    },
    "00000000-0000-0000-0000-000000000000": {
      /* Root frame */
    }
  }
}
```

All shapes from the fetched page live directly under `objects` — there is **no nesting by page-id**. The root frame always has `id === parentId === "00000000-0000-0000-0000-000000000000"`.

## Inspecting a specific shape

When debugging output for a specific shape, use the inspect script instead of ad-hoc Python one-liners (run from `packages/converter/`):

```bash
cd packages/converter
pnpm exec tsx scripts/inspect-shape.mts --file-id <uuid> --shape-id <uuid> [--html]
```

This prints:

- The full parent chain (child → root) with layout, sizing, and `layoutItemAbsolute` flags highlighted
- The shape's data (geometry noise filtered out)
- With `--html`: the rendered HTML for that shape

The HTML output file (`output.html`) is **minified to a single line** — do not try to read it with `cat` or `grep` for context. Use the inspect script or search by `data-id` attribute.

## Adding a new shape type

1. Create `packages/converter/src/converter/shapes/<type>.ts` exporting `render<Type>(shape, ctx): string`.
2. Add a `case '<type>':` in `shapes/dispatch.ts`.
3. Add a `packages/converter/src/converter/shapes/<type>.test.ts` with unit tests.