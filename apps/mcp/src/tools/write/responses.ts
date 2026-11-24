/**
 * Tool result for a write that did not happen (nothing selected, shape not
 * found, nothing to do, update-file conflict). `isError` lets MCP clients and
 * scripts tell it apart from a success, which a markdown heading alone does not.
 */
export function rejected(text: string): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  return { content: [{ type: 'text', text }], isError: true };
}
