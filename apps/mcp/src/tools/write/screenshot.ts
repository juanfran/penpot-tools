import { convertShapeToHtml } from '../../convert.ts';
import {
  buildScreenshotContent,
  type McpContentBlock,
  renderScreenshot,
} from '../../screenshot.ts';

/**
 * Convert a Penpot shape back to HTML and render it. Used by
 * `create_design_from_html` / `update_selection_from_html` when
 * `includeScreenshot:true` is passed — lets the agent get visual confirmation
 * in the same call instead of a follow-up `get_screenshot`. Failure to
 * screenshot does NOT fail the write itself; we surface the reason as text
 * so the agent can fall back to calling `get_screenshot` separately.
 */
export async function shapeScreenshotContent(
  token: string,
  fileId: string,
  pageId: string,
  shapeId: string,
  caption: string,
): Promise<McpContentBlock[]> {
  try {
    const bundle = await convertShapeToHtml(token, fileId, pageId, shapeId);
    const shot = await renderScreenshot({
      html: bundle.html,
      tokensCss: bundle.tokensCss,
      fontsCss: bundle.fontsCss,
    });
    return buildScreenshotContent(shot, caption);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return [{ type: 'text', text: `_(includeScreenshot failed: ${reason})_` }];
  }
}
