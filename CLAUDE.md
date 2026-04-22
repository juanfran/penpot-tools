# CLAUDE.md

Monorepo for converting Penpot design files (JSON) into HTML with inline styles.

## Packages

- `packages/converter` — `@penpot-random/converter`: library + CLI. Architecture details live in [`packages/converter/CLAUDE.md`](packages/converter/CLAUDE.md).
- `apps/viewer` — React app that consumes the converter.

## Where to look

Don't duplicate these here — link instead.

- **Setup, commands, CLI auth/flags, preview, tests, regenerating screenshots** → [`README.md`](README.md) and [`packages/converter/README.md`](packages/converter/README.md).
- **Converter internals (context flags, positioning, frame/flex/grid rules, tokens, adding a shape type)** → [`packages/converter/CLAUDE.md`](packages/converter/CLAUDE.md).