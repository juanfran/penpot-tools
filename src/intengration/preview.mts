/**
 * Preview an integration test fixture in the browser.
 * Usage: pnpm preview <name>
 * Example: pnpm preview card
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { extractTokens, tokenToCssVarName } from '../converter/tokens';
import type { Page } from '../penpot.types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

const name = process.argv[2];
if (!name) {
  const available = readdirSync(__dirname)
    .filter((f) => f.endsWith('.expected.html'))
    .map((f) => f.replace('.expected.html', ''))
    .sort();
  console.log('Usage: pnpm preview <name>\n');
  console.log('Available fixtures:');
  for (const f of available) console.log(`  ${f}`);
  process.exit(0);
}

const htmlPath = join(__dirname, `${name}.expected.html`);
const jsonPath = join(__dirname, `${name}.json`);

const fragment = readFileSync(htmlPath, 'utf-8').trim();

// Extract CSS custom properties from the JSON fixture
let cssVars = '';
try {
  const page: Page = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  const tokens = extractTokens(page.objects);
  if (tokens.size > 0) {
    const props = Array.from(tokens.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([n, v]) => `      --${tokenToCssVarName(n)}: ${v};`)
      .join('\n');
    cssVars = `    :root {\n${props}\n    }`;
  }
} catch {
  // No JSON fixture or no tokens — fine
}

// Collect Google Font families used in the HTML (font-['FontName'] classes)
const fontMatches = [...fragment.matchAll(/font-\['([^']+)'\]/g)];
const fontFamilies = [...new Set(fontMatches.map((m) => m[1]))];
const googleFontsUrl =
  fontFamilies.length > 0
    ? `https://fonts.googleapis.com/css2?${fontFamilies.map((f) => `family=${encodeURIComponent(f)}:wght@100;400;700;900`).join('&')}&display=swap`
    : null;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview: ${name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
${googleFontsUrl ? `  <link rel="stylesheet" href="${googleFontsUrl}" />` : ''}
  <style>
${cssVars}
  </style>
</head>
<body class="bg-gray-100 p-8">
  <p class="mb-4 font-sans text-sm text-gray-500">Preview: <strong>${name}</strong></p>
  ${fragment}
</body>
</html>
`;

const outPath = `/tmp/penpot-preview-${name}.html`;
writeFileSync(outPath, html);
console.log(`Wrote ${outPath}`);

try {
  execSync(`xdg-open ${outPath}`);
} catch {
  console.log(`Open it manually: ${outPath}`);
}
