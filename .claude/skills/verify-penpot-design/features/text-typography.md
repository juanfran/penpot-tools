# Text and typography

Text written by the LLM reads and looks the same in Penpot: every word
survives, each run keeps its font, size, weight and colour, fonts resolve to
real Penpot fonts (not the default fallback), and text styles that the design
names as typographies are linked to library typographies.

## Sub-features

- `text-content` keeps every word, including text next to inline elements
  (`$24<span>/month</span>`).
- `text-runs` keeps mixed styles within one paragraph.
- `text-fonts` sets `fontId` and `fontVariantId` for every leaf (`gfont-inter`
  for Inter).
- `text-typography` links text to a library typography (`Heading/L`).
- `text-complete` stores position-data so the text is final without anyone
  opening the page.

## How to get to it (user POV)

- Ask the agent to build a design with headings and prices: it calls
  `create_design_from_html`.
- Ask the agent to change a label: it calls `modify_shape` with `ops.text`.

## Driving it with ppv

Preconditions:

- `ppv doctor` prints `DOCTOR OK`.
- A fresh run: `R=$($P new-run text)`.

- **Seed and record the before state.** Run `$P play $R $F/pricing-card/seed.json`
  and `$P snapshot $R before`. Set `legacy` and board `Legacy note` exist; the
  `pricing-card` spec's `preserve` checks need this snapshot.
- **Build the design.** Run `$P play $R $F/pricing-card/steps.json` and
  `$P snapshot $R after`.
- **Read the MCP warnings.** Open
  the last `tmp/verify/$R/NN-create_design_from_html.response.md` (`04-` after
  the seed). A perfect run has no
  `Text dropped` or `Could not auto-load webfont` warning.
- **Render both.** Run `$P render $R "Pricing card" card`,
  `$P reference $R $F/pricing-card/design.html` and
  `$P compare $R reference.png render-card.png card`. `$24` appears in both
  images.
- **Audit.** Run
  `$P audit $R $F/pricing-card/spec.json after generic.fonts,generic.text,generic.layer-names,layer.Plan name,layer.Price,typographies.,visual.`.
  Every line reads `PASS`, including `layer.Price.content` (`$24/month`) and
  `visual.card`.

## Gotchas

- Last proof run (2026-11-24, MCP `00088f6`) failed this journey: `$24` was
  dropped (the MCP warned "Text dropped from Price"), no leaf had `fontId`, so
  Penpot drew Inter as its default font, the `/month` span became a layer
  named `span`, no typography existed, and no text had position-data.
- The MCP warned it could not load Inter, although Google Fonts answered
  from the same machine. Check `mcp-stderr.log` before blaming the network.
- `ppv editor` fills in missing position-data. Audit a snapshot taken before
  it, or this check passes for the wrong reason.
- The `includeScreenshot` image from the MCP shows the text in Inter. It is
  drawn by penpot-tools' converter, not by Penpot.