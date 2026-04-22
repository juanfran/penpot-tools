# Converter architecture

Deep dive for modifying `@penpot-random/converter`. For CLI usage, commands, and testing workflow see [`README.md`](README.md).

## Source layout

```
packages/converter/src/
  penpot.types.ts
  penpot-to-html.ts         # CLI entry point

  converter/
    index.ts                # convertPage(), convertShape(), convertPageShapes()
    render.ts               # renderShape() — adds data-penpot-* attrs
    page.ts                 # renderPage()
    types.ts                # ConverterContext, ConvertResult, FontInfo
    tokens.ts               # extractTokens(), tokensToCss(), tokenToCssVarName()

    shapes/                 # dispatch.ts + frame/rect/circle/group/text/image/path/bool/svg-raw
    visual/                 # base/fills/strokes/shadows/radius/blur/blend/position
    layout/                 # flex/grid/layout-item

    utils/
      html.ts               # tag(), escapeHtml()
      css.ts                # px() — formats number as "120px"
      style.ts              # mergeStyles() — joins CSS strings, merges box-shadow/transform
      color.ts              # hexOpacityToCss()
      transform.ts          # matrixToCss(), isIdentityMatrix()

  intengration/             # Integration tests — typo intentional, don't rename
    integration.test.ts
    mount.ts                # browser-side DOM mount + screenshot prep
    utils.ts                # import.meta.glob loader for fixture JSON
    preview.mts             # opens a fixture in the browser (pnpm preview <name>)
    *.json                  # fixture: raw Penpot page
    *.expected.html         # fixture: current expected HTML fragment (used by preview)
    __screenshots__/        # visual-regression baselines (committed)
```

## Output rule: inline styles only

All styling is emitted as inline `style=` attributes.

- `mergeStyles(...parts)` joins CSS declaration strings. It splits each part by `;`, merges multiple `box-shadow` values into one comma-separated declaration, and merges multiple `transform` values with spaces.
- `px(value)` formats a number as `"120px"`.

## ConverterContext flags

| Flag                       | Meaning                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| `_parentIsLayout`          | Parent is flex/grid; child emits `width/height: 100%` (or injected px via `_parentLayoutItemStyles`) |
| `_parentLayoutItemStyles`  | Layout-item / grid-cell styles merged onto the child directly (replaces the old wrapper div)  |
| `_parentIsLayoutAutoW/H`   | Child emits explicit `width/height: Npx` instead of 100% (auto sizing, absolute items)        |
| `_forceRelative`           | Emit `position: relative` (grid children, export root)                                        |
| `_isCanvasTopLevel`        | Direct child of root frame; use `translate()` for position                                    |
| `_isChildOfRoot`           | Enables `position: fixed` for `fixedScroll` shapes                                            |
| `_offsetX/_offsetY`        | Parent's page-absolute position for computing relative top/left                               |
| `_pageBackground`          | Background color for root frame                                                               |
| `_fontCollector`           | Map populated by text renderers                                                               |
| `tokens`                   | `Map<tokenName, cssColor>` for design token → CSS var substitution                            |
| `format`                   | When `false`, skip `oxfmt` formatting (required in the browser)                               |

## Shape positioning (`resolvePositionOutput` in `visual/position.ts`)

Priority (highest first):

1. `_parentIsLayout` → `width: 100%; height: 100%;` (autoW/autoH replace a dim with `Npx`; a dim is omitted if `_parentLayoutItemStyles` already declares it)
2. `_forceRelative` → `position: relative; width: Npx; height: Npx;`
3. `_isCanvasTopLevel` → `position: absolute; top: 0; left: 0; … transform: translate(x,y);`
4. default → `position: absolute; left: Npx; top: Npx; width: Npx; height: Npx;`

When `_parentLayoutItemStyles` is set (flex/grid child), the result above is `mergeStyles`'d with it so layout-item sizing/margin/align-self/z-index/grid-cell placement lands on the child's own div.

## Frame rendering (`shapes/frame.ts`)

- **Root frame** (`parentId === id`): `position: relative; width; height`. Never rendered directly.
- **Flex frame**: `display: flex` + direction/align/justify/gap/padding. Layout-item styles (`flex: 1` / `width: Npx` / margin / align-self / z-index / absolute) are passed to each child via `_parentLayoutItemStyles` and merged onto the child's own div.
- **Grid frame**: `display: grid` + `grid-template-columns/rows` + gap/padding. `grid-row-start` / `grid-column-start` are passed via `_parentLayoutItemStyles` and merged onto the child's own div.
- **Plain frame**: children rendered with absolute positioning offset by frame's `x/y`.
- `clipContent !== false` → `overflow: hidden`.

## Flex child ordering

Penpot stores flex children in Z-order (back-to-front). For `row` and `column` directions the array is reversed before rendering. For `row-reverse` and `column-reverse` the array is used as-is (Penpot already stores them in visual order), and the CSS `flex-direction` emitted is `row` / `column` (not `-reverse`).

## Flex / grid child sizing pattern

Layout-item / grid-cell styles (sizing, margin, `align-self`, `z-index`, `grid-row/column-start`, `layoutItemAbsolute`) are merged directly onto the child's own `data-id` div via `ctx._parentLayoutItemStyles`. No wrapper div is emitted.

```html
<div data-id="…" data-type="frame" style="width: 240px; height: 50px; display: flex; …">
  …
</div>
```

`resolvePositionOutput` reads `_parentLayoutItemStyles` and skips emitting its own `width: 100%` / `height: 100%` when the layout-item styles already declare `width:` / `height:`. For `layoutItemAbsolute` items, `layoutItemSizingStyle` is skipped entirely and the child emits its own explicit px via the `autoW`/`autoH` path.

`_parentLayoutItemStyles` must be cleared (`undefined`) in every context that is NOT a flex/grid child — plain frame children, group children — to prevent inheritance.

## Stroke alignment

| Alignment          | CSS output                     |
| ------------------ | ------------------------------ |
| `inner` / `center` | `border: Npx solid color;`     |
| `outer`            | `box-shadow: 0 0 0 Npx color;` |

## Circle / ellipse

Always `border-radius: 50%;` regardless of whether width equals height.

## Design tokens

1. Call `extractTokens(objects)` to build a `Map<tokenName, cssColor>`.
2. Pass the map as `ctx.tokens`.
3. Visual functions (`fillsToOutput`, `solidStrokeToStyle`, `textLeafColorStyle`) emit `var(--token-name, <fallback>)` when a token name is provided.
4. `tokensToCss(tokens)` generates the `:root { … }` block for the page `<style>` tag.

**When adding a new renderer**, forward `shape.appliedTokens?.fill` to `fillsToOutput` and `shape.appliedTokens?.strokeColor` to stroke functions.

## Adding a new shape type

1. Create `shapes/<type>.ts` exporting `render<Type>(shape, ctx): string`.
2. Add `case '<type>':` in `shapes/dispatch.ts`.
3. Add `shapes/<type>.test.ts`.

## Integration tests (visual regression)

Tests run in Vitest browser mode (Playwright + Chromium) and compare screenshots. The live `convertShape()` output is mounted via `intengration/mount.ts`, which injects tokens, loads Google Fonts, waits for `document.fonts.ready` and images, then shifts the content to origin so root-frame fixtures render fully in view.

- Workflow for adding a test and regenerating baselines: see [`README.md`](README.md#integration-tests-visual-regression).
- `oxfmt` is imported dynamically in `converter/index.ts` because it uses `createRequire`, which would break the browser bundle. Integration tests pass `format: false` in the context.
