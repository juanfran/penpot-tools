import { describe, it, expect } from 'vitest';
import { chromium } from 'playwright';
import { CHROMIUM_ARGS } from './screenshot';

describe('screenshot browser', () => {
  it('keeps fractional glyph advances so line breaks match Penpot', async () => {
    // Repro: an annotation board whose bold line is 291.12px wide in Penpot's
    // position data inside a 294px text box. With headless Chromium's default
    // font hinting every advance is rounded to a whole pixel, the line
    // measures 298px and wraps out of the box. Needs network (Google Fonts),
    // like the converter's integration tests.
    const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
    try {
      const page = await browser.newPage();
      await page.setContent(
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Inclusive+Sans:regular&display=block">' +
          '<span id="t" style="font: 400 16px \'Inclusive Sans\'; white-space: nowrap">Here, the hover color should be:</span>',
        { waitUntil: 'networkidle' },
      );
      const width = await page.evaluate(async () => {
        await document.fonts.load("400 16px 'Inclusive Sans'");
        return document.getElementById('t')!.getBoundingClientRect().width;
      });
      // Penpot's position data for this line: 237.58px. Hinted: 240px.
      expect(width).toBeCloseTo(237.6, 0);
    } finally {
      await browser.close();
    }
  }, 30_000);
});
