/**
 * Public surface for semantic-rule storage. The server-fn handlers below are
 * stripped to RPC stubs in the client bundle (their bodies don't run there),
 * so this file is safe to import from React components.
 *
 * - Pure types / constants live in `./semantics-types` (isomorphic).
 * - Filesystem I/O lives in `./semantics-fs.server` (server-only).
 */
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '../middlewares/auth.middleware';
import { readSemanticsRaw, writeSemanticsRaw } from './semantics-fs.server';
import { RuleSchema, type SemanticRule } from './semantics-types';

export {
  SEMANTIC_TAGS,
  type SemanticTag,
  type SemanticRule,
} from './semantics-types';

export const getSemanticRulesFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ fileId: z.uuid() }))
  .middleware([authMiddleware])
  .handler(async ({ data }): Promise<{ rules: SemanticRule[] }> => {
    const { rules } = await readSemanticsRaw(data.fileId);
    return { rules };
  });

export const setSemanticRulesFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ fileId: z.uuid(), rules: z.array(RuleSchema) }))
  .middleware([authMiddleware])
  .handler(async ({ data }): Promise<{ rules: SemanticRule[] }> => {
    await writeSemanticsRaw(data.fileId, {
      rules: data.rules,
      updatedAt: new Date().toISOString(),
    });
    return { rules: data.rules };
  });
