# Design tokens

When an LLM writes a design with `var(--token, fallback)` values and asks for a
token set, the Penpot file ends up with real tokens: the sets and themes exist,
every styled property points at its token by its Penpot name, the shape holds
the token's value, and tokens or sets that were already in the file are still
there.

## Sub-features

- `tokens-create` creates the requested sets and tokens with the right type
  and value, including `border-radius`.
- `tokens-themes` creates the requested themes.
- `tokens-apply` links fills, strokes, radius, padding and gaps to tokens by
  their dotted Penpot name (`color.primary`, not `color-primary`).
- `tokens-resolve` stores the token's value on the shape, not only the link.
- `tokens-preserve` keeps every set, theme and token that existed before.

## How to get to it (user POV)

- Ask the agent to "create these tokens and build the card with them": the
  agent calls `create_token_set`, then `create_design_from_html` with
  `var(--…)` values.
- Ask the agent to "apply token X to this layer": the agent calls
  `apply_token` or `modify_shape` with `tokenName`.

## Driving it with ppv

Preconditions:

- `ppv doctor` prints `DOCTOR OK`.
- A fresh run: `R=$($P new-run tokens)`.

- **Seed an earlier set.** Run `$P play $R $F/pricing-card/seed.json`. Prints
  `PLAY OK`; set `legacy` with `legacy.accent` now exists.
- **Record the before state.** Run `$P snapshot $R before`. Prints
  `SNAPSHOT before`.
- **Create tokens and the design.** Run `$P play $R $F/pricing-card/steps.json`.
  Prints `TOOL-OK` for `create_token_set` and `create_design_from_html`.
- **Record the after state.** Run `$P snapshot $R after`.
- **Audit.** Run
  `$P audit $R $F/pricing-card/spec.json after tokens.,preserve.token`. Every
  line reads `PASS` and the command prints `AUDIT PASS`; `audit-after.md`
  holds the table.

## Gotchas

- Last proof run (2026-11-24, MCP `00088f6`) failed this journey:
  `preserve.token-sets` lost `legacy` (`create_token_set` sends
  `set-tokens-lib`, which replaces the whole library), `radius.card` was
  missing although `steps.json` asked for it, and every applied token used the
  dashed CSS name (`color-surface`) instead of the token's name
  (`color.surface`), so the links point at tokens that do not exist.
- There is no MCP tool to create themes, so `tokens.theme.Dark` fails until
  one exists.
- `tokens.resolved.*` can pass while `tokens.applied.*` fails: the colour
  came from the CSS fallback, not from the token.
- `tokensLib` in `get-file` JSON is DTCG: set names at the top level, nested
  groups, `$value`/`$type` leaves, `$themes`, `$metadata`.