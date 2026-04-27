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

## Per-package docs

- [`packages/converter`](packages/converter/README.md) — CLI usage, auth, preview, integration tests, dev scripts.
- [`apps/mcp`](apps/mcp/README.md) — MCP server: tools, configuration snippets for Claude Code / Desktop / Cursor.

## How to run Ralph

```
/ralph-loop:ralph-loop "READ PROMPT.md a follow instructions" --completion-promise "DONE" --max-iterations 10
```