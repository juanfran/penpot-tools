import { Page } from '../penpot.types';

const pages = import.meta.glob<Page>('./*.json', { eager: true, import: 'default' });

export function getPage(name: string): Page {
  const page = pages[`./${name}.json`];
  if (!page) throw new Error(`Page fixture not found: ${name}`);
  return page;
}
