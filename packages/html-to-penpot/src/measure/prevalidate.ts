/**
 * Cheap, regex-only checks that run BEFORE booting Chromium. The point is to
 * surface foot-guns the LLM can fix without paying for a full
 * measure-and-build round-trip:
 *
 *   • The fragment is empty (no element / no visible text).
 *
 * This is intentionally NOT a full HTML parser. Browsers are forgiving — and
 * we trust them to be — so we only flag the high-signal cases.
 */
import { unwrapDocument } from './headless';

export interface PrevalidateResult {
  /** Hard errors. When non-empty, the caller should refuse to run the build. */
  errors: string[];
  /** Soft warnings. The build will still run and these merge into bundle.warnings. */
  warnings: string[];
}

const FIRST_ELEMENT_RE = /<([a-zA-Z][a-zA-Z0-9-]*)\b/;

export function prevalidateHtml(html: string): PrevalidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const inner = unwrapDocument(html).replace(/<!--[\s\S]*?-->/g, '').trim();
  if (inner.length === 0) {
    errors.push(
      'Empty HTML fragment — nothing to render. Send at least one element with content (e.g. `<div data-name="Card" style="width:200px; height:80px;"></div>`).',
    );
    return { errors, warnings };
  }

  if (!FIRST_ELEMENT_RE.test(inner)) {
    errors.push(
      'HTML fragment has no element — only text was found. Wrap the content in at least one element so it can become a Penpot shape.',
    );
  }

  return { errors, warnings };
}
