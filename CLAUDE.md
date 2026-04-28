# CLAUDE.md

Monorepo for converting between Penpot design files and HTML, in both directions.

## Packages

- `packages/converter` — `@penpot-tools/converter`: Penpot JSON → HTML (read-mode). Library + CLI. Architecture in [`packages/converter/CLAUDE.md`](packages/converter/CLAUDE.md).
- `packages/html-to-penpot` — `@penpot-tools/html-to-penpot`: HTML+CSS → Penpot `update-file` changes (write-mode). Headless Chromium measure + tree builder + change emitter. Architecture in [`packages/html-to-penpot/CLAUDE.md`](packages/html-to-penpot/CLAUDE.md).
- `apps/viewer` — React app that consumes the converter. Writes the active selection (file/page/shape) and Penpot token to `~/.config/penpot-tools/state.json` so the MCP can read them.
- `apps/mcp` — `@penpot-tools/mcp`: stdio MCP server. Read-mode tools (`get_*_html`, screenshots, asset list/download) and write-mode tools (`create_design_from_html`, `update_selection_from_html`, `modify_shape`, `apply_token`, `create_token_set`, `upload_media`). Mono-user, file-based IPC — no HTTP between viewer and MCP. Setup snippets in [`apps/mcp/README.md`](apps/mcp/README.md).

## Where to look

Don't duplicate these here — link instead.

- **Setup, commands, CLI auth/flags, preview, tests, regenerating screenshots** → [`README.md`](README.md) and [`packages/converter/README.md`](packages/converter/README.md).
- **Converter internals (Penpot → HTML)** → [`packages/converter/CLAUDE.md`](packages/converter/CLAUDE.md).
- **html-to-penpot internals (HTML → Penpot, wire schema gotchas, supported CSS subset)** → [`packages/html-to-penpot/CLAUDE.md`](packages/html-to-penpot/CLAUDE.md).
- **MCP write-mode plan and rationale** → [`MCP_WRITE_PLAN.md`](MCP_WRITE_PLAN.md).