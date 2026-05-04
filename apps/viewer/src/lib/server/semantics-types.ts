/**
 * Isomorphic types and constants for semantic-rule storage. This file MUST
 * stay free of node-only imports — both the server (`semantics-fs.server.ts`)
 * and the client (`semantic-rules.tsx`) pull from it.
 */
import { z } from 'zod';

/** Curated whitelist of semantic HTML tags the converter can emit. */
export const SEMANTIC_TAGS = [
  'div',
  'button',
  'a',
  'nav',
  'header',
  'footer',
  'main',
  'section',
  'article',
  'aside',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'label',
  'span',
] as const;

export type SemanticTag = (typeof SEMANTIC_TAGS)[number];

export const RuleSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['shape-id', 'name-equals', 'name-contains']),
  /** For `shape-id`: the UUID. For `name-*`: the layer-name pattern. */
  value: z.string().min(1),
  tag: z.enum(SEMANTIC_TAGS),
  enabled: z.boolean(),
});

export type SemanticRule = z.infer<typeof RuleSchema>;

export interface FileSemantics {
  rules: SemanticRule[];
  updatedAt?: string;
}
