# Editing an existing design

When the LLM changes part of a design that is already in Penpot, only that part
changes: layers keep their ids (so comments, prototype links and component
links stay attached), tokens applied earlier stay applied, and new tokens are
added rather than swapped in for the old ones.

## Sub-features

- `edit-apply-token` adds a token link without dropping the others.
- `edit-text` changes a label and keeps the layer id.
- `edit-replace` rewrites a subtree from HTML and keeps the ids of layers that
  are still there.
- `edit-no-loss` loses no shape, set, token or applied token outside the edit.

## How to get to it (user POV)

- "Give the primary button an accent border token": `apply_token`.
- "Change the button label to Start now": `modify_shape` with `ops.text`.
- "Redo the Details button in accent colour": `update_selection_from_html`.

## Driving it with ppv

Preconditions:

- `ppv doctor` prints `DOCTOR OK`.
- A run with the pricing card built: `R=$($P new-run edits)`, then
  `$P play $R $F/pricing-card/steps.json`.

- **Record the before state.** Run `$P snapshot $R before-edit`.
- **Apply the edits.** Run `$P play $R $F/edit-button/steps.json`. Prints
  `TOOL-OK` for `apply_token`, `modify_shape` and
  `update_selection_from_html`.
- **Record the after state.** Run `$P snapshot $R after-edit`.
- **Open the editor.** Run `$P editor $R`. Prints `EDITOR PASS`.
- **Audit.** Run `$P audit $R $F/edit-button/spec.json after-edit`. Every
  `preserve.*`, `layer.*.content` and `tokens.applied.*` line reads `PASS`.

## Gotchas

- Last proof run (2026-11-24, MCP `00088f6`): `modify_shape` text edit passed
  and kept the id. These failed: `apply_token` dropped the button's `fill` and
  `r1..r4` links (it sends the whole `appliedTokens` map); and
  `update_selection_from_html` deleted `Details` and `Details label` and
  created new layers with new ids, without linking the border to
  `color.accent`.
- `edit-button/spec.json` turns off `generic.rootOnTop`, because this journey
  is about edits, not placement.
- `${shape:Details}` resolves when the step runs. After a step that recreates
  a layer, later steps see the new id.