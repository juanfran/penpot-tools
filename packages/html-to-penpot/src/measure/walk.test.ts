import { describe, expect, it } from 'vitest';
import { NON_RENDERABLE_TAGS, WALKER_SOURCE } from './walk';

describe('NON_RENDERABLE_TAGS', () => {
  it('covers the head-only / metadata tags that have a 0×0 box but live text content', () => {
    // These are the ones that historically leaked into the canvas as stray
    // text shapes (the `<style>` regression). Lock the list so we notice if
    // someone removes one.
    expect(new Set(NON_RENDERABLE_TAGS)).toEqual(
      new Set(['style', 'script', 'meta', 'link', 'head', 'title', 'noscript', 'template', 'base']),
    );
  });

  it('is embedded into the walker source so the in-page filter stays in sync', () => {
    for (const tag of NON_RENDERABLE_TAGS) {
      expect(WALKER_SOURCE).toContain(`"${tag}"`);
    }
    expect(WALKER_SOURCE).toContain('NON_RENDERABLE.indexOf(tag) !== -1');
  });

  it('skips zero-area elements before pushing them to the node list', () => {
    // Cheap regex check: the early-return for 0×0 must come before the
    // `nodes.push(node)` call, otherwise the filter is a no-op.
    const idxZeroFilter = WALKER_SOURCE.indexOf('r.width === 0 && r.height === 0) return');
    const idxNodesPush = WALKER_SOURCE.indexOf('nodes.push(node)');
    expect(idxZeroFilter).toBeGreaterThan(0);
    expect(idxNodesPush).toBeGreaterThan(idxZeroFilter);
  });
});
