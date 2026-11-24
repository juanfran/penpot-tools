# penpot-tools

Monorepo for converting [Penpot](https://penpot.app/) design files into standalone HTML.

## Packages

| Path                 | Name                      | What it does                                                                                             |
| -------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `packages/converter` | `@penpot-tools/converter` | Library + CLI that turns a Penpot page/shape (JSON) into HTML + inline CSS                               |
| `apps/viewer`        | `viewer`                  | React app that fetches a Penpot file and renders it using the converter                                  |
| `apps/mcp`           | `@penpot-tools/mcp`       | MCP server exposing the viewer's current selection (page / shape) as tools for Claude Code, Cursor, etc. |

## Setup

```bash
pnpm install
```

The converter's integration tests use Vitest browser mode with Playwright. The first time you run them you also need:

```bash
pnpm exec playwright install chromium
```

## Commands (root)

```bash
pnpm test         # run tests across all packages
pnpm lint         # oxlint
pnpm format       # oxfmt --check
pnpm check        # oxlint --fix-dangerously && oxfmt
pnpm typecheck    # tsc --noEmit across all packages
pnpm knip         # detect unused code in converter
pnpm viewer-dev   # start the viewer app (http://localhost:3000)
pnpm penpot-to-html ...   # shortcut to the converter CLI (see its README)
```

## Verifying MCP writes in Penpot

`.claude/skills/verify-penpot-design` checks that a design written through the
MCP write tools ends up in Penpot as intended. It acts as an MCP client: it
starts the real MCP (`apps/mcp/bin/mcp.mjs`) and makes the same tool calls an
LLM would. The MCP's own answer is never taken as proof. The result is checked
three ways:

1. **Stored file.** It reads what Penpot saved (`get-file`) and compares it with
   a `spec.json` describing the perfect result: tokens, sets and themes,
   components and variants, typographies, flex layout, fonts, rotation, layer
   order, and that nothing already in the file was lost.
2. **Penpot's render.** Penpot draws the result with its own renderer (the
   exporter's `render.html`). That image is compared pixel by pixel with the
   original HTML drawn in Chromium.
3. **Editor.** It opens the file in the Penpot editor and collects any errors.

It runs against its own Penpot 2.19.5 in Docker (Compose project
`penpot-verify`, `http://localhost:9101`). Your devenv, design.penpot.app and
`~/.config/penpot-tools/state.json` are never touched.

### Requirements

- Docker.
- `pnpm install`, plus `pnpm --filter @penpot-tools/mcp exec playwright install chromium`.
- Network access: the reference render loads Google Fonts.

### With Claude Code

Ask for it in plain words, for example _"verify the MCP write path with the
verify-penpot-design skill"_ or _"run the tokens journey"_. The skill
([`SKILL.md`](.claude/skills/verify-penpot-design/SKILL.md)) and its feature
map ([`features/`](.claude/skills/verify-penpot-design/features/README.md))
tell the agent what to run and what counts as proof.

### By hand

From the repo root:

```bash
P=.claude/skills/verify-penpot-design/scripts/ppv
F=.claude/skills/verify-penpot-design/fixtures

$P up                                   # start + seed Penpot (first time pulls images)
$P doctor                               # must print DOCTOR OK

R=$($P new-run pricing-card)            # new Penpot project + file, prints the run id
$P play $R $F/pricing-card/seed.json    # content that must survive
$P snapshot $R before
$P play $R $F/pricing-card/steps.json   # the LLM's tool calls, through the real MCP
$P snapshot $R after                    # always snapshot BEFORE `editor`
$P render $R "Pricing card" card        # Penpot's own render
$P reference $R $F/pricing-card/design.html
$P compare $R reference.png render-card.png card
$P editor $R
$P audit $R $F/pricing-card/spec.json after

$P clean-run $R                         # delete the run's Penpot project
$P down                                 # stop (keeps data); `down --destroy` wipes it
```

Every command exits non-zero on failure. Everything a run produces stays in
`tmp/verify/<run-id>/` (git-ignored), even after cleanup. Start with
`audit-after.md` (every check, PASS/FAIL and why), then look at
`render-card.png`, `reference.png` and `card-diff.png`. Every MCP request and
response is saved as `NN-<tool>.*`.

### Checking a new design

Copy `fixtures/pricing-card` and change three files:

- `design.html`: the HTML the LLM writes. It may carry intent the MCP does not
  support yet (`data-component`, `data-variant`, `data-typography`).
- `steps.json`: the tool calls, as `{ "tool", "args" }`. `{"$file": "x.html"}`
  inlines a file; `${shape:<layer name>}` becomes that layer's id.
- `spec.json`: what the perfect Penpot file looks like. Write it from the
  design's intent, never from what the MCP produced.

The key list for `spec.json` is in
[`SKILL.md`](.claude/skills/verify-penpot-design/SKILL.md#fixtures). The
`edit-button` fixture checks edits on the card built by `pricing-card` (same
run).

## Per-package docs

- [`packages/converter`](packages/converter/README.md) — CLI usage, auth, preview, integration tests, dev scripts.
- [`apps/mcp`](apps/mcp/README.md) — MCP server: tools, configuration snippets for Claude Code / Desktop / Cursor.