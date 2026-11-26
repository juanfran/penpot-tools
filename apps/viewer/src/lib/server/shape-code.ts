import { createServerFn } from '@tanstack/react-start';
import z from 'zod';
import { authMiddleware } from '../middlewares/auth.middleware';
import { getPenpotBaseUrl } from '../auth';
import { buildViewerFontsCss } from './fonts.server';
import type { ConverterContext } from '@penpot-tools/converter';
import { extractTokens, tokensToCss } from '@penpot-tools/converter/tokens';
import {
  shapeToCode,
  type ShapeCodeFormat,
  type ShapeCodeStyling,
} from '@penpot-tools/converter/shape-code';
import { readSemanticsFromDisk } from '@penpot-tools/converter/semantics-store';
import type { Page, Uuid } from '@penpot-tools/penpot-types';
import { rpc } from './penpot-api-utils.server';

export type { ShapeCodeFormat, ShapeCodeStyling };

export interface ShapeCodeResult {
  code: string;
  css: string;
  fontsCss: string;
  tokensCss: string;
}

export const getShapeCodeFn = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      fileId: z.uuid(),
      pageId: z.uuid(),
      shapeId: z.uuid(),
      format: z.enum(['html', 'jsx']),
      styling: z.enum(['css', 'tailwind']),
      includeDataAttrs: z.boolean().optional(),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<ShapeCodeResult> => {
    const page = await rpc<Page>(context.token, 'get-page', {
      params: { 'file-id': data.fileId, 'page-id': data.pageId },
    });
    const shape = page.objects[data.shapeId];
    if (!shape) {
      throw new Error(`Shape ${data.shapeId} not found in page ${data.pageId}.`);
    }

    const tokens = extractTokens(page.objects);
    // Rules are read fresh server-side so another team member's edits land
    // immediately without client-cache lag.
    const rules = await readSemanticsFromDisk(data.fileId);
    const ctx: ConverterContext = {
      resolveImageUrl: (id: Uuid) => `${getPenpotBaseUrl()}/assets/by-file-media-id/${id}`,
      tokens,
    };
    const { code, css, fonts } = await shapeToCode(shape, page.objects, ctx, {
      format: data.format,
      styling: data.styling,
      includeDataAttrs: data.includeDataAttrs,
      rules,
    });

    return {
      code,
      css,
      fontsCss: await buildViewerFontsCss(fonts),
      tokensCss: tokensToCss(tokens),
    };
  });
