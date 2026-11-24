# Layout and geometry

The design keeps its structure and looks the same in Penpot: flex containers
become boards with flex layout, gaps and padding survive, rotated elements are
rotated, the new board sits on top of what was already on the page, and
Penpot's own render matches the HTML the LLM wrote.

## Sub-features

- `layout-flex` maps `display:flex`, direction, gap, padding, justify and
  align to Penpot flex layout.
- `layout-size` keeps widths and heights (box-sizing border-box, as the MCP
  promises).
- `geometry-rotation` stores rotation with a matching transform, in Penpot's
  clockwise degrees (`rotate(-8deg)` → 352°).
- `geometry-stacking` puts the new board above existing content.
- `visual-match` makes Penpot's render match the reference render.
- `editor-opens` lets the editor open the file with no error.

## How to get to it (user POV)

- Ask the agent to "build this card in Penpot": it calls
  `create_design_from_html`.

## Driving it with ppv

Preconditions:

- `ppv doctor` prints `DOCTOR OK`.
- A fresh run: `R=$($P new-run layout)`.

- **Seed a board underneath.** Run `$P play $R $F/pricing-card/seed.json` and
  `$P snapshot $R before`. Board `Legacy note` exists at (0,0); the spec's
  `preserve` checks need this snapshot.
- **Build the design.** Run `$P play $R $F/pricing-card/steps.json`, then
  `$P snapshot $R after`.
- **Render it with Penpot.** Run `$P render $R "Pricing card" card`. Writes
  `render-card.png` from Penpot's `render.html`.
- **Render the intent.** Run
  `$P reference $R $F/pricing-card/design.html`. Writes `reference.png`.
- **Compare.** Run `$P compare $R reference.png render-card.png card`. Prints
  `COMPARE PASS` and writes `compare-card-diff.png`.
- **Open the editor.** Run `$P editor $R`. Prints `EDITOR PASS`.
- **Audit.** Run `$P audit $R $F/pricing-card/spec.json after`. The
  `layer.*.layout*`, `generic.rotation-transform`, `layer.Popular
badge.rotation`, `generic.root-on-top`, `visual.card` and `editor.opens`
  lines read `PASS`.

## Gotchas

- Last proof run (2026-11-24, MCP `00088f6`): flex direction, gaps, padding
  and size passed. These failed: the badge was stored as 8° (wrong
  direction) with an identity transform, so Penpot draws it unrotated;
  `Legacy note` stayed above the new card; and the compare failed at 7.46 %
  because of text (see text-typography.md).
- Penpot's rotation is clockwise on screen (`common/geom/matrix.cljc`
  `rotate-matrix`), the same as CSS, so CSS `rotate(-8deg)` is 352°.
- `ppv reference` uses `scripts/reference-base.css`. Without the preflight
  (border-box), a 320 px card with 24 px padding measures 368 px and the
  compare fails for the wrong reason.
- Compare only the root you rendered; `ppv render` crops to that layer.
- Opening the editor can resize texts whose size drifted, so run
  `ppv snapshot` before `ppv editor`.