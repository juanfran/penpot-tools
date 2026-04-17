declare module 'transit-js' {
  interface Keyword {
    name(): string;
    toString(): string;
  }

  interface TransitMap {
    get<T = TransitMap>(key: Keyword | string): T | undefined;
    keys(): IterableIterator<Keyword>;
  }

  interface Reader {
    read(json: string): TransitMap;
  }

  function reader(type: 'json' | 'json-verbose'): Reader;
  function keyword(name: string): Keyword;

  export { reader, keyword };
  export type { Keyword, TransitMap, Reader };
}
