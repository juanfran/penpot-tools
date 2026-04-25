# Penpot Viewer — Electron

Desktop wrapper around `apps/viewer`. The Electron main process spawns the
viewer's standalone Nitro server (output of `pnpm --filter viewer build`) on a
local port and loads it inside a `BrowserWindow`.

## Why a server?

The viewer is **not** a static SPA. It's a TanStack Start + Nitro app with SSR,
server functions and a `/proxy-fonts/**` proxy. Running it inside Electron
therefore means starting its server. Fortunately Nitro's `node-server` preset
emits a self-contained bundle under `apps/viewer/.output/` (≈20 MB) that can be
launched with plain `node`, with no runtime dependency on Vite or pnpm.

## Layout

```
apps/electron/
├── main.cjs        # Electron main: spawns the viewer server, opens the window
├── preload.cjs     # Renderer preload (currently empty, reserved for IPC)
├── package.json    # Electron + electron-builder scripts and config
└── README.md
```

## Requirements

- Node `^24.14.1` (matches the workspace `engines.node` field)
- `pnpm` `10.x` (workspace package manager)
- Workspace dependencies installed at the repo root (`pnpm install`)

## Install

From the repo root:

```bash
pnpm install
```

This installs Electron + `electron-builder` under `apps/electron/node_modules`.
The first install also runs Electron's postinstall (it's whitelisted in the
root `package.json` under `pnpm.onlyBuiltDependencies`) which downloads the
Electron binary.

## Run locally

```bash
# from the repo root
pnpm --filter viewer-electron dev
```

That command:

1. Builds the viewer (`pnpm --filter viewer build`), producing
   `apps/viewer/.output/{public,server}` (Nitro `node-server` preset).
2. Launches Electron, which spawns `node apps/viewer/.output/server/index.mjs`
   on `http://localhost:4173` and loads it in a window.

If the viewer is already built and you only want to (re)launch Electron:

```bash
pnpm --filter viewer-electron start
```

### Configuration

| Env var       | Default | Purpose                                                  |
| ------------- | ------- | -------------------------------------------------------- |
| `VIEWER_PORT` | `4173`  | Port that the viewer server binds to internally.         |

## Packaging the desktop app

Packaging uses [`electron-builder`](https://www.electron.build/). The included
config bundles `apps/viewer/.output` under `resources/viewer-output/` inside the
final artifact. At runtime Electron resolves the server via
`process.resourcesPath` so the same `main.cjs` works in dev and packaged.

Build commands (run from the repo root):

```bash
# Current platform
pnpm --filter viewer-electron package

# Specific targets
pnpm --filter viewer-electron package:linux   # AppImage
pnpm --filter viewer-electron package:mac     # dmg
pnpm --filter viewer-electron package:win     # NSIS installer
```

Output ends up in `apps/electron/release/`.

### Notes on bundling

- The Electron app itself has zero production dependencies — only `main.cjs`,
  `preload.cjs` and `package.json` are packed into `app.asar`. The viewer's
  Nitro bundle ships unpacked under `resources/viewer-output/` as
  `extraResources`.
- Cross-compiling between platforms is possible but recommended only when
  targeting the same OS family. Signed/notarized macOS builds need to run on
  macOS with the appropriate certificates.
- Custom icons go in `apps/electron/build/` (`icon.png`, `icon.icns`,
  `icon.ico`). `electron-builder` picks them up automatically.

## How it works

`main.cjs`:

1. Resolves the Nitro server entry — `apps/viewer/.output/server/index.mjs` in
   dev, `process.resourcesPath/viewer-output/server/index.mjs` when packaged.
2. Spawns it with `process.execPath` (Electron's bundled Node) and `PORT` set
   to `VIEWER_PORT`.
3. Polls `http://localhost:$VIEWER_PORT` until it responds, then opens a
   `BrowserWindow` pointing at that URL. External links open in the system
   browser via `shell.openExternal`.

When the window closes (or the app quits) the spawned server is killed.

## Troubleshooting

- **"Viewer build not found"** — run `pnpm --filter viewer build` first, or use
  `pnpm --filter viewer-electron dev` which does it for you.
- **Port already in use** — set `VIEWER_PORT` to a free port before launching.
- **Electron postinstall didn't run** — make sure `electron` is listed under
  `pnpm.onlyBuiltDependencies` at the repo root, then run `pnpm install` again.
