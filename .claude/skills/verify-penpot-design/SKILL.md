---
name: verify-penpot-design
description: Verify that a design written by an LLM through the penpot-tools MCP (apps/mcp write tools) lands in Penpot exactly as intended, and uses Penpot features (tokens, components, variants, typographies, flex layout) instead of flat shapes. Drives the real MCP over stdio against a disposable Penpot 2.19.5 in Docker, then proves the result from the stored file, Penpot's own renderer and the editor. Use it after changing apps/mcp, packages/html-to-penpot or packages/converter write code, before claiming a write feature works, or to check a new LLM-authored design.
---

# Verify a design written through the penpot-tools MCP

The surface under test is the MCP's write path: an MCP client calls
`create_token_set`, `create_design_from_html`, `apply_token`, `modify_shape`,
`update_selection_from_html` or `upload_media`, and a Penpot file changes. The
harness plays the MCP client. The proof never comes from the MCP's own
answer: it comes from the file Penpot stored, the picture Penpot itself
renders, and the editor opening that file.

Everything goes through one helper, `scripts/ppv` (run from the repo root):

```bash
P=.claude/skills/verify-penpot-design/scripts/ppv
```

## Launch

```bash
$P up
```

- Starts Docker Compose project `penpot-verify` from `scripts/compose.yaml`:
  frontend, backend, exporter, Postgres 15 and Valkey, Penpot `2.19.5`, on
  `http://localhost:9101` (bound to 127.0.0.1). Volumes are
  `penpot-verify_postgres` and `penpot-verify_assets`; nothing is shared with
  the devenv or any other instance.
- Waits until the backend answers `get-profile` and the frontend serves `/`,
  then seeds from empty: registers `verify@example.com`, logs in, creates an
  access token, and writes `tmp/verify/.instance.json` (mode 0600).
- Ready means it prints `READY http://localhost:9101 (...)`. First start pulls
  images and runs migrations; allow a few minutes.
- `PPV_PORT` and `PPV_PENPOT_VERSION` override port and image tag. Set the same
  values for every later `ppv` call.
- Compose flags that matter: `enable-access-tokens` (the MCP authenticates with
  `Authorization: Token`), `disable-email-verification`, and
  `disable-admin-console`. Without the last one Penpot 2.19 answers every
  request with `503 nitrate-not-configured`.

Prerequisites: Docker, `pnpm install` done, and the Chromium build that
`apps/mcp`'s Playwright wants (`pnpm --filter @penpot-tools/mcp exec playwright
install chromium`). The reference render loads Google Fonts, so it needs
network access.

## Doctor

```bash
$P doctor
```

Read-only. Checks the five containers are running, port 9101 belongs to
`penpot-verify`, images carry the expected tag, the stored token resolves to
the bot user, Playwright's Chromium exists, and `apps/mcp` has its
dependencies. It prints the MCP commit and warns about uncommitted changes in
`apps/` or `packages/` (a run proves the working tree, not `HEAD`). Ends with
`DOCTOR OK` or `DOCTOR FAIL` plus reasons. Run it first, and again whenever
anything looks off. Never drive an instance that `ppv up` did not start.

## Drive

One journey = one run. A run gets its own Penpot project and file, and its own
evidence folder `tmp/verify/<run-id>/`.

```bash
R=$($P new-run pricing-card)               # project + file, prints the run id
$P play $R <fixture>/seed.json             # optional: content that must survive
$P snapshot $R before                      # stored file before the change
$P play $R <fixture>/steps.json            # the LLM's tool calls, through the real MCP
$P snapshot $R after                       # stored file after the change
$P render $R "<root layer name>" card      # Penpot's own render of the result
$P reference $R <fixture>/design.html      # the design as the LLM meant it
$P compare $R reference.png render-card.png card
$P editor $R                               # open the file in the Penpot editor
$P audit $R <fixture>/spec.json after      # facts about the stored file
```

Order matters: take every snapshot before `ppv editor`. Opening the editor
makes Penpot write text position-data and resize drifted texts, which changes
the file you are auditing.

Single tool calls, for exploring or for a step a fixture lacks:

```bash
$P mcp $R --list-tools
$P mcp $R get_page_overview '{"maxDepth":3}'
$P mcp $R modify_shape '{"shapeId":"${shape:Choose plan}","ops":{"radius":12}}'
```

The MCP runs as `node apps/mcp/bin/mcp.mjs` with `PENPOT_BASE_URL`,
`PENPOT_TOKEN` and `PENPOT_RANDOM_STATE_FILE=<run>/mcp-state.json` (selection =
the run's file and page), so it never reads or writes the user's
`~/.config/penpot-tools/state.json`. `PPV_MCP_MODE=read-only` starts it in
read-only mode.

### Fixtures

A fixture is a folder in `fixtures/`:

- `design.html`: what the LLM wrote. It may carry intent the MCP does not
  support yet (`data-component`, `data-variant`, `data-typography`); the spec
  decides whether that intent must show up in Penpot.
- `seed.json` (optional) and `steps.json`: lists of
  `{"tool", "args", "continueOnError"?}`. In args, `{"$file": "x.html"}` inlines
  a file from the fixture folder; `${fileId}`, `${pageId}`, `${teamId}` and
  `${shape:<layer name>}` are replaced before the call (layer names must be
  unique on the page).
- `spec.json`: what a perfect translation looks like in the stored file.
  Keys: `root` (layer name), `generic` (turn off a generic check with
  `false`: `rootOnTop`, `layerNames`, `fonts`, `rotation`, `positionData`),
  `layers` (`attrs` compared after lower-casing hex colours, `text` leaf
  attributes, `content`, `rotation` in CSS degrees, `fill`), `tokens`
  (`sets`, `themes`, `tokens`, `applied` with optional `resolved`),
  `components` (`defined` with `variants`, `instances`), `typographies`
  (`name`, `usedBy`), `colors`, `preserve` (`from` snapshot label,
  `sameId`, `allowDeleted`), `visual` (compare labels) and `editor`.

Write a spec from the design's intent, never from what the MCP produced. To
check a new LLM design, copy `fixtures/pricing-card`, replace `design.html`,
write `steps.json` with the calls the LLM would make, and write `spec.json`
from the design.

The feature map in `features/README.md` lists every journey. Read it before
choosing what to drive.

## Evidence

Everything lands in `tmp/verify/<run-id>/` (ignored by git through `**/tmp/*`):

- `NN-<tool>.request.json`, `.response.json`, `.response.md`, and
  `.image-N.png`: every MCP call, its answer and its duration. `TOOL-ERROR`
  marks `isError` or an error text.
- `snapshot-<label>.json`: the stored file from `get-file`.
- `render-<label>.png` (+ `.json` with page errors): Penpot's `render.html`,
  the same path the exporter uses.
- `reference.png`: `design.html` in Chromium with `scripts/reference-base.css`
  (the MCP's documented Tailwind preflight contract) and Google Fonts.
- `<label>-diff.png` and `<label>.json`: red pixels differ by more than 48 in
  any channel; passes when sizes match within 1 px and mismatch ≤ 2 %.
- `editor.png` and `editor.json`: the workspace after 8 s, page errors,
  console errors, error screen text.
- `audit-<label>.md` and `.json`: every check with PASS/FAIL and the reason.
- `mcp-stderr.log`, `run.json`, copies of the fixture files used.

Proof standards:

- A journey passes only when `audit` passes. `audit` folds in the `visual`
  compares and the editor check that the spec names.
- Look at `reference.png`, `render-*.png` and the diff yourself. The mismatch
  ratio is diluted by large flat fills: a missing word on a big card can stay
  under a few percent.
- The MCP's `includeScreenshot` image and "Created board" text are claims, not
  proof. Its screenshot is drawn by penpot-tools' own converter and can show
  things Penpot does not render.
- Report a failing check as a failure with its audit line. Never edit a spec
  to match what the MCP produced.

## Cleanup

```bash
$P clean-run $R          # deletes the run's Penpot project, removes mcp-state.json (token)
$P down                  # stops penpot-verify, keeps its volumes (fast restart)
$P down --destroy        # also removes penpot-verify_* volumes and .instance.json
```

Cleanup never touches `tmp/verify/<run-id>/`; evidence survives all three.
Only stop what `ppv up` started: these commands act on Compose project
`penpot-verify` and nothing else. If a `ppv` call hangs, kill that process by
PID, not by name: the user's own penpot-viewer MCP and Chromium processes look
the same.

## Helpers

| Command                                                 | What it does                                        |
| ------------------------------------------------------- | --------------------------------------------------- |
| `ppv up`                                                | Start and seed the disposable Penpot                |
| `ppv doctor`                                            | Read-only health check                              |
| `ppv new-run [label]`                                   | New project + file + evidence folder; prints run id |
| `ppv play <run> <steps.json or fixture dir>`            | Run tool calls through the real MCP                 |
| `ppv mcp <run> <tool> [json or file]` / `--list-tools`  | One MCP call                                        |
| `ppv snapshot <run> [label]`                            | Save the stored file (`get-file`)                   |
| `ppv render <run> "<layer>" [label]`                    | Penpot render of one layer                          |
| `ppv reference <run> <design.html> [label]`             | Intended render of the HTML                         |
| `ppv compare <run> <a.png> <b.png> [label] [threshold]` | Pixel diff                                          |
| `ppv editor <run>`                                      | Open the file in the editor, collect errors         |
| `ppv audit <run> [spec.json] [snapshot label]`          | Check the stored file against a spec                |
| `ppv clean-run <run>`                                   | Delete the run's project; keep evidence             |
| `ppv down [--destroy]`                                  | Stop the instance                                   |
| `ppv logs [service]`                                    | Last 80 log lines (default `penpot-backend`)        |

Every command exits non-zero on failure, so `&&` chains stop at the first
broken step.