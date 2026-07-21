import { describe, expect, it } from 'vitest';
import type { Page, Shape } from '@penpot-tools/converter/types';
import { buildPageOverview } from './convert.ts';

function base(id: string, name: string, type: Shape['type'], parentId: string) {
  return {
    id,
    name,
    type,
    parentId,
    frameId: parentId,
    selrect: { x: 10, y: 20, width: 100, height: 40 },
    points: [],
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    transformInverse: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  };
}

const root = {
  ...base('root', 'Root', 'frame', 'root'),
  x: 0,
  y: 0,
  width: 1000,
  height: 800,
  shapes: ['board'],
} as unknown as Shape;

const board = {
  ...base('board', 'Dashboard', 'frame', 'root'),
  x: 0,
  y: 0,
  width: 800,
  height: 600,
  shapes: ['title', 'button-a', 'sidebar'],
  layoutType: 'flex',
  layoutFlexDir: 'column',
} as unknown as Shape;

const title = {
  ...base('title', 'Heading', 'text', 'board'),
  content: {
    type: 'root',
    children: [
      {
        type: 'paragraph-set',
        children: [
          {
            type: 'paragraph',
            children: [{ text: 'Welcome back', fontFamily: '"Work Sans"' }],
          },
        ],
      },
    ],
  },
} as unknown as Shape;

const buttonA = {
  ...base('button-a', 'Button', 'rect', 'board'),
  x: 10,
  y: 80,
  width: 120,
  height: 40,
  r1: 8,
  appliedTokens: { r1: 'radius.m' },
} as unknown as Shape;

const sidebar = {
  ...base('sidebar', 'Sidebar', 'frame', 'board'),
  x: 600,
  y: 0,
  width: 200,
  height: 600,
  shapes: ['button-b', 'photo'],
} as unknown as Shape;

const buttonB = {
  ...base('button-b', 'Button', 'rect', 'sidebar'),
  x: 620,
  y: 20,
  width: 120,
  height: 40,
  hidden: true,
} as unknown as Shape;

const photo = {
  ...base('photo', 'Profile photo', 'image', 'sidebar'),
  x: 620,
  y: 100,
  width: 64,
  height: 64,
  metadata: { id: 'media-1', mtype: 'image/png', width: 64, height: 64 },
} as unknown as Shape;

const page = {
  id: 'page-1',
  name: 'Page 1',
  objects: Object.fromEntries(
    [root, board, title, buttonA, sidebar, buttonB, photo].map((shape) => [shape.id, shape]),
  ),
} as unknown as Page;

describe('buildPageOverview', () => {
  it('returns the page as a recursive tree by default', () => {
    const out = buildPageOverview(page, 'file-1', 'page-1');

    expect(out.totalShapes).toBe(6);
    expect(out.typeCounts).toEqual({ frame: 2, text: 1, rect: 2, image: 1 });
    expect(out.commonNames).toContainEqual({ name: 'Button', count: 2 });
    expect(out.fontsUsed).toEqual(['Work Sans']);
    expect(out.tree).toMatchObject({
      id: 'page-1',
      name: 'Page 1',
      type: 'page',
      childCount: 1,
      descendantCount: 6,
      children: [
        {
          id: 'board',
          name: 'Dashboard',
          layout: 'flex:column',
          children: [
            { id: 'title', text: 'Welcome back' },
            { id: 'button-a' },
            {
              id: 'sidebar',
              children: [{ id: 'button-b', flags: ['hidden'] }, { id: 'photo' }],
            },
          ],
        },
      ],
    });
    expect(out.treeMeta).toMatchObject({
      maxDepth: 4,
      returnedNodes: 6,
      totalNodes: 6,
      truncated: false,
    });
    expect(out).not.toHaveProperty('matches');
  });

  it('marks branches omitted by maxDepth', () => {
    const out = buildPageOverview(page, 'file-1', 'page-1', { maxDepth: 1 });

    expect(out.tree?.children).toEqual([
      expect.objectContaining({
        id: 'board',
        childCount: 3,
        descendantCount: 5,
        childrenOmitted: 3,
      }),
    ]);
    expect(out.tree?.children?.[0]).not.toHaveProperty('children');
    expect(out.treeMeta).toMatchObject({
      returnedNodes: 1,
      truncated: true,
      truncatedByDepth: true,
      truncatedByNodeLimit: false,
    });
  });

  it('enforces maxNodes independently of depth', () => {
    const out = buildPageOverview(page, 'file-1', 'page-1', {
      maxDepth: 8,
      maxNodes: 2,
    });

    expect(out.treeMeta).toMatchObject({
      returnedNodes: 2,
      totalNodes: 6,
      truncated: true,
      truncatedByNodeLimit: true,
    });
    expect(out.tree?.children?.[0]).toMatchObject({
      id: 'board',
      childrenOmitted: 2,
      children: [{ id: 'title' }],
    });
  });

  it('finds nodes using name/text/ancestor AND terms and includes lookup fields', () => {
    const textOut = buildPageOverview(page, 'file-1', 'page-1', {
      includeTree: false,
      query: 'welcome back',
    });
    expect(textOut).not.toHaveProperty('tree');
    expect(textOut.matches).toHaveLength(1);
    expect(textOut.matches?.[0]).toMatchObject({
      id: 'title',
      type: 'text',
      path: 'Dashboard > Heading',
      text: 'Welcome back',
    });

    const ancestorOut = buildPageOverview(page, 'file-1', 'page-1', {
      query: 'sidebar button',
      queryFields: ['path'],
    });
    expect(ancestorOut.matches).toHaveLength(1);
    expect(ancestorOut.matches?.[0]).toMatchObject({
      id: 'button-b',
      path: 'Dashboard > Sidebar > Button',
      flags: ['hidden'],
    });
  });

  it('filters by type and scope, including media IDs for image results', () => {
    const images = buildPageOverview(page, 'file-1', 'page-1', { types: ['image'] });
    expect(images.matches).toEqual([
      expect.objectContaining({ id: 'photo', type: 'image', mediaId: 'media-1' }),
    ]);

    const scoped = buildPageOverview(page, 'file-1', 'page-1', {
      scopeId: 'sidebar',
      types: ['rect'],
    });
    expect(scoped.matches?.map((match) => match.id)).toEqual(['button-b']);
  });

  it('caps matches and reports truncation', () => {
    const out = buildPageOverview(page, 'file-1', 'page-1', {
      types: ['rect'],
      maxResults: 1,
    });
    expect(out.search).toMatchObject({ matched: 2, returned: 1, truncated: true });
    expect(out.matches).toHaveLength(1);
  });

  it('fails with a recoverable error for an unknown scope', () => {
    expect(() => buildPageOverview(page, 'file-1', 'page-1', { scopeId: 'missing' })).toThrow(
      /Call get_page_overview without scopeId/,
    );
  });
});
