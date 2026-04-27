# @penpot-tools/mcp

MCP server that exposes the design the user currently has open in the **penpot-tools viewer** (`apps/viewer`) to any MCP-compatible client (Claude Code, Claude Desktop, Cursor, …).

The viewer writes the active selection (file / page / shape) and the Penpot access token to a small JSON file in the user's home directory. This MCP server reads from that file, calls Penpot directly, and converts the design into HTML using `@penpot-tools/converter`.

## What it does

| Tool                    | When to use it                                                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_current_selection` | _"What am I looking at right now?"_ — returns `{ fileId, pageId, shapeId? }`                                                                                                                                     |
| `get_current_html`      | _"Update the html with the design I have in penpot dev mode"_ — returns the HTML for the currently selected shape, or the full open page if none picked                                                          |
| `get_page_html`         | _"Create the html of the page I have open"_ — always returns the full page                                                                                                                                       |
| `get_shape_html`        | _"Give me the HTML for the Header board"_ — converts an arbitrary shape by id (e.g. one returned by `get_page_overview`); `fileId`/`pageId` default to the current selection                                     |
| `get_page_tokens`       | _"Generate the tokens file for this page"_ — returns the design tokens applied on the page + a `:root { … }` CSS block                                                                                           |
| `get_page_overview`     | _"Give me a quick overview of the page in penpot dev mode"_ — returns boards, fonts, top tokens; no HTML, just structure                                                                                         |
| `get_screenshot`        | Renders the selected shape (or full page) in headless Chromium and returns a PNG. Pair with `get_current_html` so the agent can both _see_ the design and read its tokens/sizes.                                 |
| `list_assets`           | _"What images does this page use?"_ — returns the unique image media on the page (image shapes, fill images, stroke images) with id, mime type, dimensions, the Penpot URL, and which shapes reference each one. |
| `download_asset`        | _"Save image X locally"_ — fetches the bytes for one media id (auth'd) and returns them as an inline image (png/jpeg/gif/webp) or raw text (svg). Capped at 5 MB.                                                |

The HTML returned is **raw**: a `<div>` tree with inline `style="…"` attributes and Penpot-emitted `data-*` traceability attributes. The MCP `instructions` block tells the calling agent to convert that into idiomatic semantic HTML / Tailwind / JSX / Vue / etc. depending on the user's project — so prompts like _"update my React+Tailwind component"_ or _"make me a Vue page"_ Just Work.

## Prerequisites

1. The viewer must be running at least once so it can write the access token and the current selection:

   ```bash
   pnpm viewer-dev
   ```

   Then sign in with a Penpot access token and open a file/page (and optionally select a shape). Both navigation and shape selection are persisted automatically.

2. Node.js 22+ (the MCP runs through `tsx` from the bundled `node_modules`).

3. Chromium for the `get_screenshot` tool (the rest of the tools work without it):

   ```bash
   pnpm exec playwright install chromium
   ```

## State file

The viewer writes, and the MCP reads, a single JSON file:

```
~/.config/penpot-tools/state.json
```

```json
{
  "token": "…",
  "selection": {
    "fileId": "…",
    "pageId": "…",
    "shapeId": "…" // optional
  },
  "updatedAt": "2026-04-27T13:42:00.000Z"
}
```

Override the path with `PENPOT_RANDOM_STATE_FILE` (useful for tests / sandboxed installs).

You can also bypass the state file entirely by setting `PENPOT_TOKEN` directly in the MCP environment — handy if you want to point the MCP at a Penpot file without running the viewer (you'll then need to pass `fileId` / `pageId` to each tool yourself).

## Installation

The MCP is a workspace package. From the repo root:

```bash
pnpm install
```

## Configuration

### Claude Code

```bash
claude mcp add penpot-viewer -- node /absolute/path/to/penpot-tools/apps/mcp/bin/mcp.mjs
```

…or edit `~/.claude.json` directly:

```json
{
  "mcpServers": {
    "penpot-viewer": {
      "command": "node",
      "args": ["/absolute/path/to/penpot-tools/apps/mcp/bin/mcp.mjs"]
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "penpot-viewer": {
      "command": "node",
      "args": ["/absolute/path/to/penpot-tools/apps/mcp/bin/mcp.mjs"]
    }
  }
}
```

### Cursor / generic MCP client

Same shape — `command: "node"`, `args: ["…/apps/mcp/bin/mcp.mjs"]`. The bin shim spawns `tsx` from the package's bundled `node_modules`, so there is **no build step**.

### Optional environment variables

| Var                        | Purpose                                                           |
| -------------------------- | ----------------------------------------------------------------- |
| `PENPOT_TOKEN`             | Use this token instead of the one written by the viewer           |
| `PENPOT_BASE_URL`          | Self-hosted Penpot instance (default `https://design.penpot.app`) |
| `PENPOT_RANDOM_STATE_FILE` | Override the JSON state file location                             |

## Example session

```
User: I'm in the viewer, I selected the Login form board.
       Update src/app/login/page.tsx with that design.

Agent (Claude): [calls get_current_html → receives raw HTML + tokens + fonts]
                [reads src/app/login/page.tsx, sees Tailwind + React]
                [rewrites the component using semantic <form>, <label>,
                 <input>, Tailwind utilities, var(--color-…) tokens]
```

## Sanity check (manual)

You can poke the server over stdio to confirm it boots:

```bash
cd apps/mcp
(printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'; \
 sleep 1) | pnpm start
```

You should see the `initialize` response (with the long `instructions` block) followed by `tools/list` advertising the registered tools.

## Design notes

- **Mono-user / file-based IPC.** The viewer is a local mono-user app, so a single JSON file in `~/.config/penpot-tools/` is enough to share state between the viewer (writer) and the MCP (reader). No HTTP server, no auth dance, no race conditions worth worrying about.
- **No build step.** `bin/mcp.mjs` spawns `tsx` from the local `node_modules` and runs `src/index.ts` directly. Edit a `.ts` file → next MCP invocation picks it up.
- **Conversion happens in-process.** The MCP imports `@penpot-tools/converter` directly; it does not call the viewer's HTTP API. That decouples it from the viewer process: the viewer can be down and the MCP still works as long as a token + the user-supplied IDs are available.
- **Screenshot uses headless Chromium, not the running viewer.** `get_screenshot` builds a self-contained HTML doc (preflight + tokens + fonts + converter HTML) and renders it in a Chromium instance launched from this process. The browser is launched lazily on first call and reused for the lifetime of the MCP process. Same bounding-box / wait-for-fonts trick as `packages/converter/src/intengration/mount.ts`.