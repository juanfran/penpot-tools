# CLAUDE.md

## What this project does

Converts Penpot design files (JSON) into HTML with inline styles. Given a Penpot page or shape object, it emits a `<div>` tree with `style=` attributes that faithfully reproduces the visual design.

## Monorepo structure

```
penpot-random/
  package.json              # root scripts: test, lint, check, penpot-to-html
  packages/
    converter/              # @penpot-random/converter
      cache/                # gitignored; raw API responses
      scripts/              # dev scripts (add-test-case, inspect-shape)
      src/                  # all source and tests
```

## Commands

```bash
pnpm test                   # run all tests (vitest)
pnpm test -- --run          # run once, no watch
pnpm lint / pnpm check
pnpm penpot-to-html --file-id <uuid> [--page-id <uuid>] [--shape-id <uuid>] [--output <path>] [--cache]
```

Auth: set `PENPOT_TOKEN`, or `PENPOT_EMAIL` + `PENPOT_PASSWORD`.

## Source layout

```
packages/converter/src/
  penpot.types.ts
  penpot-to-html.ts         # CLI entry point

  converter/
    index.ts                # convertPage(), convertShape()
    render.ts               # renderShape() — adds data-penpot-* attrs
    page.ts                 # renderPage()
    types.ts                # ConverterContext, ConvertResult, FontInfo
    tokens.ts               # extractTokens(), tokensToCss()

    shapes/                 # dispatch.ts + frame/rect/circle/group/text/image/path/bool/svg-raw
    visual/                 # base/fills/strokes/shadows/radius/blur/blend/position
    layout/                 # flex/grid/layout-item

    utils/
      html.ts               # tag(), escapeHtml()
      css.ts                # px() — formats number as "120px"
      style.ts              # mergeStyles() — joins CSS strings, merges box-shadow/transform
      color.ts              # hexOpacityToCss()
      transform.ts          # matrixToCss(), isIdentityMatrix()

  intengration/             # Integration tests (typo intentional — keep it)
    integration.test.ts
    *.json / *.expected.html
```

## Output rule: inline styles only

**All styling is emitted as inline `style=` attributes. No CSS classes anywhere.**

- `mergeStyles(...parts)` joins CSS declaration strings. It splits each part by `;`, merges multiple `box-shadow` values into one comma-separated declaration, and merges multiple `transform` values with spaces.
- `px(value)` formats a number as `"120px"`.

## ConverterContext flags

| Flag | Meaning |
| --- | --- |
| `_parentIsLayout` | Parent is flex/grid; child emits `width/height: 100%` |
| `_forceRelative` | Emit `position: relative` (grid children, export root) |
| `_isCanvasTopLevel` | Direct child of root frame; use `translate()` for position |
| `_isChildOfRoot` | Enables `position: fixed` for `fixedScroll` shapes |
| `_offsetX/_offsetY` | Parent's page-absolute position for computing relative top/left |
| `_pageBackground` | Background color for root frame |
| `_fontCollector` | Map populated by text renderers |
| `tokens` | `Map<tokenName, cssColor>` for design token → CSS var substitution |

## Shape positioning (`resolvePositionOutput` in `visual/position.ts`)

Priority (highest first):
1. `_parentIsLayout` → `width: 100%; height: 100%;`
2. `_forceRelative` → `position: relative; width: Npx; height: Npx;`
3. `_isCanvasTopLevel` → `position: absolute; top: 0; left: 0; … transform: translate(x,y);`
4. default → `position: absolute; left: Npx; top: Npx; width: Npx; height: Npx;`

## Frame rendering (`shapes/frame.ts`)

- **Root frame** (`parentId === id`): `position: relative; width; height`. Never rendered directly.
- **Flex frame**: `display: flex` + direction/align/justify/gap/padding. Children wrapped in sizing divs.
- **Grid frame**: `display: grid` + `grid-template-columns/rows` + gap/padding. Children wrapped in cell divs with `grid-row-start` / `grid-column-start`.
- **Plain frame**: children rendered with absolute positioning offset by frame's `x/y`.
- `clipContent !== false` → `overflow: hidden`.

## Flex child ordering

Penpot stores flex children in Z-order (back-to-front). For `row` and `column` directions the array is reversed before rendering. For `row-reverse` and `column-reverse` the array is used as-is (Penpot already stores them in visual order), and the CSS `flex-direction` emitted is `row` / `column` (not `-reverse`).

## Flex child sizing pattern

```html
<div style="width: 240px; height: 50px">   <!-- wrapper: layout-item sizing -->
  <div style="width: 100%; height: 100%; display: flex; …">…</div>  <!-- child -->
</div>
```

Wrapper is omitted when its style is empty.

## Stroke alignment

| Alignment | CSS output |
| --- | --- |
| `inner` / `center` | `border: Npx solid color;` |
| `outer` | `box-shadow: 0 0 0 Npx color;` |

## Circle / ellipse

Always `border-radius: 50%;` regardless of whether width equals height.

## Design tokens

1. Call `extractTokens(objects)` to build a `Map<tokenName, cssColor>`.
2. Pass the map as `ctx.tokens`.
3. Visual functions (`fillsToOutput`, `solidStrokeToStyle`, `textLeafColorStyle`) use `var(--token-name)` when a token name is provided.
4. `tokensToCss(tokens)` generates the `:root { … }` block for the `<style>` tag.

**When adding a new renderer**, forward `shape.appliedTokens?.fill` to `fillsToOutput` and `shape.appliedTokens?.strokeColor` to stroke functions.

## Adding a new integration test

**Step 1** — fetch and cache:
```bash
pnpm penpot-to-html --file-id <uuid> --page-id <uuid> --cache
```

**Step 2** — create fixture (from `packages/converter/`):
```bash
pnpm exec tsx scripts/add-test-case.mts --name <name> --file-id <uuid> --board-id <uuid>
```

**Step 3** — add the printed snippet to `integration.test.ts`.

To regenerate expected HTML after intentional output changes, re-run the add-test-case script. Do not hand-edit `.expected.html` files.

## Adding a new shape type

1. Create `shapes/<type>.ts` exporting `render<Type>(shape, ctx): string`.
2. Add `case '<type>':` in `shapes/dispatch.ts`.
3. Add `shapes/<type>.test.ts`.
