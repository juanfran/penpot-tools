import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { CHROMIUM_ARGS, prepareOutputPath, renderScreenshot, saveScreenshot } from './screenshot';

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

/** Width/height from a PNG's IHDR chunk (bytes 16–24, big-endian). */
function pngSize(base64: string): { width: number; height: number } {
  const buf = Buffer.from(base64, 'base64');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const render = (html: string, extra: Partial<Parameters<typeof renderScreenshot>[0]> = {}) =>
  renderScreenshot({ html, fontsCss: '', tokensCss: '', ...extra });

describe('renderScreenshot', () => {
  it('trims to the default cap and flags it', async () => {
    const shot = await render('<div style="width: 2400px; height: 300px; background: red"></div>');
    expect(shot).toMatchObject({ width: 1600, height: 300, fullWidth: 2400, trimmed: true });
    expect(pngSize(shot.base64)).toEqual({ width: 1600, height: 300 });
  }, 30_000);

  it('renders the whole content at 1x when fullSize is set', async () => {
    const shot = await render('<div style="width: 2400px; height: 300px; background: red"></div>', {
      fullSize: true,
    });
    expect(shot).toMatchObject({ width: 2400, height: 300, trimmed: false, scale: 1 });
    expect(pngSize(shot.base64)).toEqual({ width: 2400, height: 300 });
  }, 30_000);

  it('multiplies the pixel size by scale and reports the real PNG size', async () => {
    const shot = await render('<div style="width: 200px; height: 100px; background: red"></div>', {
      scale: 2,
      fullSize: true,
    });
    expect(shot).toMatchObject({
      width: 200,
      height: 100,
      scale: 2,
      pixelWidth: 400,
      pixelHeight: 200,
    });
    expect(pngSize(shot.base64)).toEqual({ width: 400, height: 200 });
  }, 30_000);

  it('only scales full-size renders, so inline images stay under the cap', async () => {
    await expect(
      render('<div style="width: 200px; height: 100px; background: red"></div>', { scale: 2 }),
    ).rejects.toThrow(/fullSize/);
  }, 30_000);

  it('refuses a render smaller than one device pixel instead of hanging', async () => {
    await expect(
      render('<div style="width: 1px; height: 1px; background: red"></div>', {
        scale: 0.25,
        fullSize: true,
      }),
    ).rejects.toThrow(/too small/);
  }, 30_000);

  it('does not grow the box for content clipped by overflow: hidden', async () => {
    // A board with clip content: Penpot exports the board size, not the
    // size of whatever overflows it.
    const shot = await render(
      '<div style="position: relative; width: 200px; height: 100px; overflow: hidden; background: red">' +
        '<div style="position: absolute; left: 500px; top: 0; width: 100px; height: 400px; background: blue"></div>' +
        '</div>',
      { fullSize: true },
    );
    expect(shot).toMatchObject({ width: 200, height: 100 });
  }, 30_000);

  it('includes outer box-shadows in the box', async () => {
    // 0 10px 20px: reaches 20px left/right, 10px above and 30px below.
    const shot = await render(
      '<div style="width: 100px; height: 100px; background: red; box-shadow: 0 10px 20px 0 rgba(0,0,0,0.5)"></div>',
      { fullSize: true },
    );
    expect(shot).toMatchObject({ width: 140, height: 140 });
  }, 30_000);

  it('accepts a tall page past 16384 px', async () => {
    const shot = await render(
      '<div style="width: 400px; height: 20000px; background: red"></div>',
      {
        fullSize: true,
      },
    );
    expect(pngSize(shot.base64)).toEqual({ width: 400, height: 20000 });
  }, 60_000);

  it('refuses images larger than the export area limit', async () => {
    await expect(
      render('<div style="width: 9000px; height: 9000px; background: red"></div>', {
        fullSize: true,
      }),
    ).rejects.toThrow(/too large/);
  }, 30_000);

  it('keeps the shadow of a transformed element, whose offset turns with it', async () => {
    // rotate(180deg) paints a +30px x-offset shadow on the left.
    const shot = await render(
      '<div style="width: 100px; height: 100px; background: red; transform: rotate(180deg); box-shadow: 30px 0 0 0 blue"></div>',
      { fullSize: true },
    );
    expect(shot.width).toBeGreaterThanOrEqual(130);
    const data = Buffer.from(shot.base64, 'base64');
    expect(data.length).toBeGreaterThan(0);
  }, 30_000);

  it('keeps the shadow of a zero-size element', async () => {
    const shot = await render(
      '<div style="position: absolute; left: 100px; top: 100px; width: 0; height: 0; box-shadow: 0 0 0 50px blue"></div>',
      { fullSize: true },
    );
    expect(shot).toMatchObject({ width: 100, height: 100 });
  }, 30_000);

  it('includes the bleed of a layer blur', async () => {
    // A blur(10px) bleeds about three times its radius.
    const shot = await render(
      '<div style="width: 100px; height: 100px; background: red; filter: blur(10px)"></div>',
      { fullSize: true },
    );
    expect(shot).toMatchObject({ width: 160, height: 160 });
  }, 30_000);
});

describe('saveScreenshot', () => {
  const shot = {
    base64: Buffer.from('png-bytes').toString('base64'),
    width: 10,
    height: 5,
    fullWidth: 10,
    fullHeight: 5,
    trimmed: false,
    scale: 1,
    pixelWidth: 10,
    pixelHeight: 5,
  };

  it('writes the PNG, creating missing folders', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'penpot-shot-'));
    try {
      const target = join(dir, 'nested', 'board@1x.png');
      const saved = await saveScreenshot(shot, target);
      expect(saved).toEqual({ path: target, bytes: 9 });
      expect(await readFile(target, 'utf8')).toBe('png-bytes');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects relative paths and non-png names', async () => {
    await expect(prepareOutputPath('board.png')).rejects.toThrow(/absolute/);
    await expect(prepareOutputPath('/tmp/board.jpg')).rejects.toThrow(/\.png/);
  });

  it('refuses to overwrite an existing file unless asked', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'penpot-shot-'));
    try {
      const target = join(dir, 'board.png');
      await writeFile(target, 'old');
      await expect(prepareOutputPath(target)).rejects.toThrow(/already exists/);
      await expect(saveScreenshot(shot, target)).rejects.toThrow(/already exists/);
      await saveScreenshot(shot, target, { overwrite: true });
      expect(await readFile(target, 'utf8')).toBe('png-bytes');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('never writes through a symbolic link', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'penpot-shot-'));
    try {
      const victim = join(dir, 'victim.txt');
      await writeFile(victim, 'keep me');
      const link = join(dir, 'board.png');
      await symlink(victim, link);
      await expect(prepareOutputPath(link, { overwrite: true })).rejects.toThrow(/symbolic link/);
      await expect(saveScreenshot(shot, link, { overwrite: true })).rejects.toThrow(
        /symbolic link/,
      );
      expect(await readFile(victim, 'utf8')).toBe('keep me');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
