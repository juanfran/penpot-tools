# @penpot-tools/mcp

MCP server that exposes the design the user currently has open in the **penpot-tools viewer** (`apps/viewer`) to any MCP-compatible client (Claude Code, Claude Desktop, Cursor, …).

The viewer writes the active selection (file / page / shape) and the Penpot access token to a small JSON file in the user's home directory. This MCP server reads from that file, calls Penpot directly, and converts the design into HTML using `@penpot-tools/converter`.

The server can run in two modes:

- **`read-write`** (default) — read tools + write tools. The agent can both inspect the design and modify it.
- **`read-only`** — read tools only. Write tools are not registered at all, so the agent literally cannot modify the file even if it tries. Recommended for frontend work where you only want to mirror the design into code, never the other way around.

Set the mode with the `PENPOT_MCP_MODE` env var. See [Read-only vs read-write](#read-only-vs-read-write) for setup snippets.

## What it does

### Read-mode (inspect the design)

| Tool                    | When to use it                                                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_current_selection` | _"What am I looking at right now?"_ — returns `{ fileId, pageId, shapeId? }`                                                                                                                                     |
| `get_html`              | _"Give me the HTML for the design / the Header board / file X page Y"_ — single tool for every shape/page case. No args → viewer selection (selected shape, else page); `shapeId` → that shape; `fileId`/`pageId` → that page (works without the viewer open). Pass `includeScreenshot:true` to also get a PNG in the same response — saves a follow-up `get_screenshot` when implementing or reworking a design. |
| `get_page_tokens`       | _"Generate the tokens file for this page"_ — returns the design tokens applied on the page + a `:root { … }` CSS block                                                                                           |
| `get_page_overview`     | _"Give me a quick overview of the page"_ — returns boards, fonts, top tokens; no HTML, just structure. Use it to discover board ids before calling `get_html({ shapeId })`.                                       |
| `get_screenshot`        | Image-only render. Most flows are better served by `get_html({ includeScreenshot:true })` — use this when you only want the PNG (no HTML payload).                                                               |
| `list_assets`           | _"What images does this page use?"_ — returns the unique image media on the page (image shapes, fill images, stroke images) with id, mime type, dimensions, the Penpot URL, and which shapes reference each one. |
| `download_asset`        | _"Save image X locally"_ — fetches the bytes for one media id (auth'd) and returns them as an inline image (png/jpeg/gif/webp) or raw text (svg). Capped at 5 MB.                                                |

### Write-mode (modify the design)

| Tool                          | When to use it                                                                                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_design_from_html`     | _"Build a homepage / a card / a dashboard"_ — renders the HTML in headless Chromium, measures every element, and creates a new top-level board on the open page. Pass `includeScreenshot:true` to get a PNG of the result back in the same call (skips the follow-up `get_screenshot`). |
| `update_selection_from_html`  | _"Modify the selected header / redesign this card"_ — replaces the currently-selected shape and all its descendants with a fresh subtree built from the provided HTML, anchored at the same x/y. Pass `includeScreenshot:true` to get a PNG of the result back in the same call. |
| `modify_shape`                | _"Apply primary token to bg, increase radius to 16, rename to Hero"_ — single `mod-obj` change, fastest path, preserves the shape id                                                            |
| `apply_token`                 | _"Apply the brand-primary token to the fill of this shape"_ — surgical alternative to `modify_shape` for setting `appliedTokens` slots only                                                     |
| `create_token_set`            | _"Create a design system / register these colours as tokens"_ — replaces the file's `tokens-lib` in one shot (DTCG `$type`/`$value` via Transit JSON)                                           |
| `upload_media`                | _"Use this hero.png in the design"_ — uploads local images and returns Penpot media ids; reference them via `data-penpot-media-id="<id>"` on `<img>` tags inside the HTML                       |

The CSS subset accepted by `create_design_from_html` / `update_selection_from_html` is documented in the MCP `instructions` block (sent to the agent on connect) and in [`packages/html-to-penpot/CLAUDE.md`](../../packages/html-to-penpot/CLAUDE.md).

After any write-mode call **the user has to refresh the file in Penpot** to see the change — the MCP does not push live updates.

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

| Var                        | Purpose                                                                          |
| -------------------------- | -------------------------------------------------------------------------------- |
| `PENPOT_MCP_MODE`          | `read-write` (default) or `read-only`. See [Read-only vs read-write](#read-only-vs-read-write). |
| `PENPOT_TOKEN`             | Use this token instead of the one written by the viewer                          |
| `PENPOT_BASE_URL`          | Self-hosted Penpot instance (default `https://design.penpot.app`)                |
| `PENPOT_RANDOM_STATE_FILE` | Override the JSON state file location                                            |

## Read-only vs read-write

By default the MCP registers **all** tools — read and write. If you only use it to mirror designs into code (e.g. you're a frontend dev rewriting components from Penpot) you probably never want the agent to push changes back. Switch to read-only and the write tools are not registered at all — the agent can't call them even if it asks.

| Mode         | Tools available                                                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `read-write` (default) | All tools: `get_*`, `list_assets`, `download_asset`, `create_design_from_html`, `update_selection_from_html`, `modify_shape`, `apply_token`, `create_token_set`, `upload_media` |
| `read-only`  | Read tools only: `get_current_selection`, `get_html`, `get_page_tokens`, `get_page_overview`, `get_screenshot`, `list_assets`, `download_asset`                              |

The instructions block sent to the agent on connect also changes — in `read-only` mode it explicitly tells the agent the server cannot modify the design, so it won't offer to.

### Pick the mode

The mode is controlled by the `PENPOT_MCP_MODE` env var on the **MCP server process** (not your shell). You set it where the MCP client launches the server. Restart the client after changing it.

#### Claude Code

```bash
# read-only (frontend-only setup, no write tools registered)
claude mcp add penpot-viewer --env PENPOT_MCP_MODE=read-only -- node /absolute/path/to/penpot-tools/apps/mcp/bin/mcp.mjs

# read-write (default — same as omitting the var)
claude mcp add penpot-viewer -- node /absolute/path/to/penpot-tools/apps/mcp/bin/mcp.mjs
```

…or edit `~/.claude.json` directly:

```json
{
  "mcpServers": {
    "penpot-viewer": {
      "command": "node",
      "args": ["/absolute/path/to/penpot-tools/apps/mcp/bin/mcp.mjs"],
      "env": {
        "PENPOT_MCP_MODE": "read-only"
      }
    }
  }
}
```

#### Claude Desktop / Cursor / generic MCP client

Same shape — add an `env` block alongside `command` and `args`:

```json
{
  "mcpServers": {
    "penpot-viewer": {
      "command": "node",
      "args": ["/absolute/path/to/penpot-tools/apps/mcp/bin/mcp.mjs"],
      "env": {
        "PENPOT_MCP_MODE": "read-only"
      }
    }
  }
}
```

Invalid values (anything other than `read-only` or `read-write`) make the server exit on startup with a clear error — useful to catch typos early.

## Example session

```
User: I'm in the viewer, I selected the Login form board.
       Update src/app/login/page.tsx with that design.

Agent (Claude): [calls get_html({ includeScreenshot: true })
                 → receives raw HTML + tokens + fonts + a PNG render]
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