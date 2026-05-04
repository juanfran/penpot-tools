/**
 * Re-export from `@penpot-tools/converter/shape-code` so client code keeps
 * importing from this familiar path. We add a zod schema here for the input
 * validation needed by `setSemanticRulesFn` — the converter package itself is
 * zod-free.
 */
import { z } from 'zod';
import { SEMANTIC_TAGS, type SemanticTag } from '@penpot-tools/converter/shape-code';

export {
  SEMANTIC_TAGS,
  type SemanticTag,
  type SemanticRule,
} from '@penpot-tools/converter/shape-code';

export const RuleSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['shape-id', 'name-equals', 'name-contains']),
  value: z.string().min(1),
  tag: z.enum(SEMANTIC_TAGS) as z.ZodType<SemanticTag>,
  enabled: z.boolean(),
});
