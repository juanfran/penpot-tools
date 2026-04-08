//  @ts-check

/** @type {import('prettier').Config} */
const config = {
  singleQuote: true,
  semi: true,
  bracketSameLine: true,
  singleAttributePerLine: true,
  trailingComma: 'all',
  plugins: ['prettier-plugin-tailwindcss'],
};

export default config;
