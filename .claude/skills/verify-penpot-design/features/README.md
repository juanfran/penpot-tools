# Penpot write verification map

This directory is the maintained source for verifying that designs written by
an LLM through the penpot-tools MCP land in Penpot as intended. Read the index
before driving, then use the matching feature file as the recipe.

## Baseline preconditions

- `ppv up` started the disposable Penpot (`penpot-verify`, `http://localhost:9101`).
- `ppv doctor` prints `DOCTOR OK`.
- Every journey starts from `R=$(ppv new-run <label>)`: an empty file with one
  page. Journeys that edit build on the `pricing-card` fixture inside the same
  run.
- `P=.claude/skills/verify-penpot-design/scripts/ppv` and
  `F=.claude/skills/verify-penpot-design/fixtures`, from the repo root.

## Driving conventions

- Drive the MCP only through `ppv play` or `ppv mcp`: they speak MCP over stdio
  to `apps/mcp/bin/mcp.mjs`, the same path a real client uses.
- Never write to the file through the Penpot API directly; that would test the
  harness, not the MCP.
- Address layers by name with `${shape:<name>}`. Fixture layer names are unique
  on purpose.
- Snapshot before `ppv editor`: opening the editor rewrites texts.
- Journeys audited with `fixtures/pricing-card/spec.json` start with
  `ppv play $R $F/pricing-card/seed.json` and `ppv snapshot $R before`; without
  that snapshot `preserve.snapshot` fails for a reason that is not the MCP's.

## Proof and skip reporting

- A journey's proof is its `audit-<label>.md`, plus the render, reference and
  diff images it names, all in `tmp/verify/<run-id>/`.
- Quote the failing audit lines in the report. Name the feature file and the
  fixture used.
- When the MCP has no tool for a step (for example, creating a component), the
  journey still runs its spec: the checks fail and the report says which tool
  is missing. Do not drop the checks.
- A journey that could not run (doctor failure, Docker down) is reported as not
  verified, with the failing command. It is never reported through another
  journey.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph on the behavior a
designer or developer expects. It then has exactly four H2 sections in this
order: `Sub-features`, `How to get to it (user POV)`, `Driving it with ppv`,
`Gotchas`.

## Features

- [Design tokens](./tokens.md): token sets and themes, tokens applied to
  shapes, resolved values, nothing earlier lost.
- [Components and variants](./components.md): repeated UI becomes components,
  copies and variants.
- [Layout and geometry](./layout-geometry.md): flex layout, sizing, rotation,
  stacking order, visual match.
- [Text and typography](./text-typography.md): fonts resolve, mixed runs
  survive, typographies are linked.
- [Editing an existing design](./edits.md): edits keep layer ids and earlier
  applied tokens.