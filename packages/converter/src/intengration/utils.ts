import { Page } from '../penpot.types';

interface ImportMetaWithGlob {
  glob<T>(pattern: string, options: { eager: true; import: 'default' }): Record<string, T>;
}

const pages = (import.meta as unknown as ImportMetaWithGlob).glob<Page>('./*.json', {
  eager: true,
  import: 'default',
});

export function getPage(name: string): Page {
  const page = pages[`./${name}.json`];
  if (!page) throw new Error(`Page fixture not found: ${name}`);
  return page;
}
