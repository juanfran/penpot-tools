# penpot-to-html

Fetches a Penpot page via the API and outputs its HTML (with Tailwind CDN).

## Usage

```bash
PENPOT_TOKEN=<token> pnpm penpot-to-html \
  --file-id <uuid> \
  [--page-id <uuid>] \
  [--base-url https://your-instance.com/api/main] \
  > output.html
```

## Authentication (pick one)

| Env var                            | Description                               |
| ---------------------------------- | ----------------------------------------- |
| `PENPOT_TOKEN`                     | Access token from Penpot profile settings |
| `PENPOT_EMAIL` + `PENPOT_PASSWORD` | Username/password login                   |

## Options

| Flag         | Required | Description                                                       |
| ------------ | -------- | ----------------------------------------------------------------- |
| `--file-id`  | yes      | UUID of the Penpot file                                           |
| `--page-id`  | no       | UUID of the page (defaults to first page)                         |
| `--shape-id` | no       | UUID of a specific shape to render (renders full page if omitted) |
| `--output`   | no       | Path to write the HTML file (prints to stdout if omitted)         |
| `--cache`    | no       | Use cached response from `cache/<file-id>.json` if available      |
| `--base-url` | no       | API base URL (default: `https://design.penpot.app/api/main`)      |

## Cache

Every API response is automatically saved to `cache/<file-id>.json`. Pass `--cache` to reuse it on subsequent calls and skip the network request.

## Examples

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

## Preview integration test fixtures

Visualize a `.expected.html` fixture in the browser with Tailwind CSS, design tokens, and Google Fonts applied:

```bash
pnpm preview <name>
```

Examples:

```bash
pnpm preview card
pnpm preview tokens
pnpm preview grid-stroke-shadow-overflow
```

The script reads `src/intengration/<name>.expected.html` and the corresponding `<name>.json`, injects CSS custom properties for any design tokens, loads the required Google Fonts, and opens the result in the browser.

# How to run Ralph

/ralph-loop:ralph-loop "READ PROMPT.md a follow instructions" --completion-promise "DONE" --max-iterations 10