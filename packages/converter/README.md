# @penpot-random/converter

Converts a Penpot page or shape (JSON) into HTML with inline styles. Ships both a library API (`convertPage`, `convertShape`, `convertPageShapes`) and a CLI (`penpot-to-html`) that fetches a file from a Penpot instance and prints the HTML.

Output is plain `<div>` trees with `style="..."` — no CSS classes, no external stylesheet. Design tokens are emitted as CSS custom properties with the resolved color as fallback (`var(--token, #fff)`).

## CLI: `penpot-to-html`

Fetches a Penpot page and writes the HTML.

```bash
PENPOT_TOKEN=<token> pnpm penpot-to-html \
  --file-id <uuid> \
  [--page-id <uuid>] \
  [--shape-id <uuid>] \
  [--output <path>] \
  [--cache] \
  [--base-url https://your-instance.com/api/main]
```

### Authentication (pick one)

| Env var                            | Description                               |
| ---------------------------------- | ----------------------------------------- |
| `PENPOT_TOKEN`                     | Access token from Penpot profile settings |
| `PENPOT_EMAIL` + `PENPOT_PASSWORD` | Username/password login                   |

### Options

| Flag         | Required | Description                                                       |
| ------------ | -------- | ----------------------------------------------------------------- |
| `--file-id`  | yes      | UUID of the Penpot file                                           |
| `--page-id`  | no       | UUID of the page (defaults to first page)                         |
| `--shape-id` | no       | UUID of a specific shape to render (renders full page if omitted) |
| `--output`   | no       | Path to write the HTML file (prints to stdout if omitted)         |
| `--cache`    | no       | Use cached response from `cache/<file-id>.json` if available      |
| `--base-url` | no       | API base URL (default: `https://design.penpot.app/api/main`)      |

### Cache

Every API response is saved to `cache/<file-id>.json`. Pass `--cache` to reuse it and skip the network request.

### Examples

```bash
# Full page to stdout
PENPOT_TOKEN=xxx pnpm penpot-to-html --file-id <uuid>

# Full page to file
PENPOT_TOKEN=xxx pnpm penpot-to-html --file-id <uuid> --output page.html

# Specific shape to file
PENPOT_TOKEN=xxx pnpm penpot-to-html --file-id <uuid> --page-id <uuid> --shape-id <uuid> --output shape.html

# Use cached response (no network request if cache exists)
PENPOT_TOKEN=xxx pnpm penpot-to-html --file-id <uuid> --cache --output page.html

# Self-hosted instance
PENPOT_TOKEN=xxx pnpm penpot-to-html --file-id <uuid> --base-url https://your-instance.com/api/main --output page.html
```

## Commands

```bash
pnpm test         # runs unit + integration (browser) tests with vitest
pnpm typecheck    # tsc --noEmit
pnpm knip         # detect unused code
pnpm preview <name>   # open an integration fixture in the browser (see below)
```

## Integration tests (visual regression)

Integration fixtures live in `src/intengration/` (the typo is intentional — keep it) and use Vitest's browser mode with Playwright + Chromium. Each test:

1. Reads a `<name>.json` fixture (a cached Penpot page).
2. Calls `convertShape()` on the shape under test.
3. Mounts the resulting HTML in the browser via `src/intengration/mount.ts`, which applies tokens, loads Google Fonts, and shifts the content to origin so root-frame fixtures render in view.
4. Takes a screenshot and compares it against the reference in `src/intengration/__screenshots__/`.

Screenshots are checked in. To regenerate them after an intentional output change:

```bash
rm -rf src/intengration/__screenshots__
pnpm test --run
pnpm test --run   # second pass confirms the new baselines match
```

The first pass writes the new references (tests fail with "No existing reference screenshot found"). The second pass verifies everything is stable.

Prerequisite (once per machine):

```bash
pnpm exec playwright install chromium
```

### Preview an integration fixture

`preview.mts` wraps a committed `<name>.expected.html` fragment in a full HTML page with Tailwind, the fixture's tokens, and any referenced Google Fonts, then opens it in your browser:

```bash
pnpm preview <name>
```

Run without arguments to list available fixtures. The `.expected.html` files are written by `add-test-case.mts` and `regen-expected.mts` — if you change converter logic, regenerate them before previewing, otherwise you'll see stale output:

```bash
pnpm exec tsx scripts/regen-expected.mts
```

### Add a new integration test

```bash
# 1. Fetch and cache the page
pnpm penpot-to-html --file-id <uuid> --page-id <uuid> --cache

# 2. Copy the page into the fixtures folder and write the initial expected HTML
pnpm exec tsx scripts/add-test-case.mts --name <test-name> --file-id <uuid> --board-id <uuid>

# 3. Paste the printed snippet into src/intengration/integration.test.ts
# 4. Run tests to generate the screenshot baseline
pnpm test --run
pnpm test --run
```

## Dev scripts

| Script                            | What it does                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `scripts/add-test-case.mts`       | Creates an integration fixture from a cached page + prints a test snippet         |
| `scripts/regen-expected.mts`      | Regenerates every `.expected.html` file from the current converter output         |
| `scripts/inspect-shape.mts`       | Prints a shape and its parent chain from a cached page (add `--html` for output)  |
| `src/intengration/preview.mts`    | Opens an `.expected.html` fragment as a full page in the browser                  |
