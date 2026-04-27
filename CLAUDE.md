# CLAUDE.md

Monorepo for converting Penpot design files (JSON) into HTML with inline styles.

## Packages

- `packages/converter` — `@penpot-random/converter`: library + CLI. Architecture details live in [`packages/converter/CLAUDE.md`](packages/converter/CLAUDE.md).
- `apps/viewer` — React app that consumes the converter. Writes the active selection (file/page/shape) and Penpot token to `~/.config/penpot-random/state.json` so the MCP can read them.
- `apps/mcp` — `@penpot-random/mcp`: stdio MCP server (`@modelcontextprotocol/sdk` v1) that surfaces the viewer's current selection as tools (`get_current_html`, `get_page_html`, `get_page_tokens`, `get_page_overview`, `get_current_selection`). Mono-user, file-based IPC — no HTTP between viewer and MCP. Setup snippets in [`apps/mcp/README.md`](apps/mcp/README.md).

## Where to look

Don't duplicate these here — link instead.

- **Setup, commands, CLI auth/flags, preview, tests, regenerating screenshots** → [`README.md`](README.md) and [`packages/converter/README.md`](packages/converter/README.md).
- **Converter internals (context flags, positioning, frame/flex/grid rules, tokens, adding a shape type)** → [`packages/converter/CLAUDE.md`](packages/converter/CLAUDE.md).