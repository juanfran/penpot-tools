# Components and variants

When a design repeats a UI element (buttons, badges, list rows), the Penpot
result has one main component, with variants where the design has states or
types, and the repeated elements are copies of it, not loose shapes. A designer
can then change the main and every copy follows.

## Sub-features

- `components-define` creates the main component with the intended name.
- `components-variants` groups the variants (`Type=Primary`,
  `Type=Secondary`) under one component.
- `components-instances` makes each repeated element a copy of that
  component, not a main and not a plain frame.
- `components-overrides` keeps per-copy text (`Choose plan`, `Details`) as
  overrides on the copy.

## How to get to it (user POV)

- Ask the agent to "build this card and make the buttons a Button component
  with Primary and Secondary variants". The design marks intent with
  `data-component="Button"` and `data-variant="Type=…"`.

## Driving it with ppv

Preconditions:

- `ppv doctor` prints `DOCTOR OK`.
- A fresh run: `R=$($P new-run components)`.

- **Seed and record the before state.** Run `$P play $R $F/pricing-card/seed.json`
  and `$P snapshot $R before`. Set `legacy` and board `Legacy note` exist; the
  `pricing-card` spec's `preserve` checks need this snapshot.
- **Build the design.** Run `$P play $R $F/pricing-card/steps.json`. Prints
  `PLAY OK`.
- **Record the result.** Run `$P snapshot $R after`.
- **Audit.** Run `$P audit $R $F/pricing-card/spec.json after components.`.
  `components.defined.Button`, `components.variants.Button`,
  `components.instance.Choose plan` (`Type=Primary`) and
  `components.instance.Details` (`Type=Secondary`) read `PASS`.
- **See it.** Run `$P editor $R`; `editor.png` shows the layers. Copies show
  the component icon in the layer panel.

## Gotchas

- Last proof run (2026-11-24, MCP `00088f6`) failed every `components.*` check:
  no MCP tool creates components, and `create_design_from_html` ignores
  `data-component` and `data-variant`. When a tool for this lands, add its call
  to `fixtures/pricing-card/steps.json`; do not loosen the spec.
- `get-file` lists deleted components with `deleted: true`; the audit skips
  them.
- A main component placed inside the card would pass `defined` but fail
  `instance` for that layer: the audit requires a copy (`mainInstance` unset).