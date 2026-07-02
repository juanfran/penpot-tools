import transit from 'transit-js';

export interface FileTokenSet {
  id: string;
  name: string;
  css: string;
  tokenCount: number;
  kind?: 'theme' | 'set';
  active?: boolean;
}

function tokenToCssVarName(tokenName: string): string {
  return tokenName.replace(/\./g, '-');
}

function transitValue(value: unknown): unknown {
  return value && typeof value === 'object' && 'rep' in value
    ? (value as { rep: unknown }).rep
    : value;
}

function transitGet(value: unknown, key: string): unknown {
  value = transitValue(value);
  if (!value) return undefined;
  if (typeof (value as { get?: unknown }).get !== 'function') {
    if (typeof value !== 'object' || Array.isArray(value)) return undefined;
    const object = value as Record<string, unknown>;
    return object[key] ?? object[key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)];
  }
  const map = value as { get: (k: unknown) => unknown };
  return (
    map.get(transit.keyword(key)) ??
    map.get(transit.keyword(key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`))) ??
    map.get(key)
  );
}

function mapEntries(value: unknown): [unknown, unknown][] {
  value = transitValue(value);
  if (Array.isArray(value)) {
    return value.filter((entry): entry is [unknown, unknown] => Array.isArray(entry) && entry.length >= 2);
  }
  const hasMapApi =
    !!value &&
    typeof (value as { keys?: unknown }).keys === 'function' &&
    typeof (value as { get?: unknown }).get === 'function';
  if (!value || !hasMapApi) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const object = value as Record<string, unknown>;
    const wrappedMap = object['map'];
    if (wrappedMap && typeof wrappedMap === 'object') {
      const hashMap = wrappedMap as { map?: unknown; _keys?: unknown[] };
      if (
        hashMap.map &&
        typeof hashMap.map === 'object' &&
        Array.isArray(hashMap._keys)
      ) {
        return hashMap._keys.flatMap((hash): [unknown, unknown][] => {
          const entry = (hashMap.map as Record<string, unknown>)[String(hash)];
          return Array.isArray(entry) && entry.length >= 2 ? [[entry[0], entry[1]]] : [];
        });
      }
      if (
        typeof (wrappedMap as { keys?: unknown }).keys === 'function' &&
        typeof (wrappedMap as { get?: unknown }).get === 'function'
      ) {
        return mapEntries(wrappedMap);
      }
      return Object.entries(wrappedMap as Record<string, unknown>);
    }
    return Object.entries(value as Record<string, unknown>);
  }
  const map = value as { keys: () => Iterable<unknown>; get: (key: unknown) => unknown };
  return [...map.keys()].map((key) => [key, map.get(key)]);
}

function keyName(key: unknown): string {
  let raw: string;
  if (key && typeof key === 'object' && '_name' in key) {
    raw = String((key as { _name: unknown })._name);
  } else if (key && typeof key === 'object' && 'name' in key) {
    const name = (key as { name: unknown }).name;
    raw = typeof name === 'function' ? String((name as () => unknown)()) : String(name);
  } else {
    raw = String(key);
  }
  return raw.replace(/^~:/, '');
}

function tokenValue(token: unknown): string | undefined {
  const raw = transitGet(token, '$value') ?? transitGet(token, 'value');
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'number') return String(raw);
  if (typeof raw === 'string') {
    const ref = raw.match(/^\{([^}]+)\}$/);
    return ref ? `var(--${tokenToCssVarName(ref[1])})` : raw;
  }
  return undefined;
}

function collectTokenCssLines(tokens: unknown, prefix = ''): [string, string][] {
  const entries: [string, string][] = [];

  for (const [rawName, token] of mapEntries(tokens)) {
    const name = prefix ? `${prefix}.${keyName(rawName)}` : keyName(rawName);
    const value = tokenValue(token);
    if (value) {
      entries.push([name, value]);
      continue;
    }
    entries.push(...collectTokenCssLines(token, name));
  }

  return entries;
}

function entriesToCss(entries: [string, string][]): { css: string; tokenCount: number } | undefined {
  if (entries.length === 0) return undefined;
  const lines = entries
    .map(([name, value]) => `    --${tokenToCssVarName(name)}: ${value};`)
    .sort();
  return { css: `:root {\n${lines.join('\n')}\n  }`, tokenCount: lines.length };
}

interface TokenSetDefinition {
  id: string;
  name: string;
  entries: [string, string][];
}

function hasDirectTokenEntries(value: unknown): boolean {
  return mapEntries(value).some(([, child]) => tokenValue(child) !== undefined);
}

function collectTokenSetDefinitions(value: unknown, path: string[] = []): TokenSetDefinition[] {
  const tokens = transitGet(value, 'tokens');
  if (tokens) {
    const name = String(transitGet(value, 'name') ?? path.join('/'));
    return [
      {
        id: name,
        name,
        entries: collectTokenCssLines(tokens),
      },
    ];
  }

  if (path.length > 0 && hasDirectTokenEntries(value)) {
    const name = path.join('/');
    return [{ id: name, name, entries: collectTokenCssLines(value) }];
  }

  return mapEntries(value).flatMap(([rawKey, child]) =>
    collectTokenSetDefinitions(child, [...path, keyName(rawKey)]),
  );
}

function collectThemeSets(value: unknown): string[] {
  const sets = transitGet(value, 'sets');
  return mapEntries(sets).map(([rawKey, rawValue]) => String(rawValue ?? keyName(rawKey)));
}

function themePath(name: string, group: string): string {
  return `${group}/${name}`.replace(/\/+/g, '/');
}

function collectActiveThemePaths(value: unknown): Set<string> {
  return new Set(mapEntries(value).map(([rawKey, rawValue]) => String(rawValue ?? keyName(rawKey))));
}

function collectThemes(value: unknown): { id: string; name: string; sets: string[]; path: string }[] {
  const themeSets = collectThemeSets(value);
  if (themeSets.length > 0) {
    const name = String(transitGet(value, 'name') ?? '');
    const group = String(transitGet(value, 'group') ?? '');
    if (!name || name === '__PENPOT__HIDDEN__TOKEN__THEME__') return [];
    return [{ id: `theme:${themePath(name, group)}`, name, sets: themeSets, path: themePath(name, group) }];
  }

  return mapEntries(value).flatMap(([, child]) => collectThemes(child));
}

export function extractTokenSetsFromTokensLib(tokensLib: unknown): FileTokenSet[] {
  const definitions = collectTokenSetDefinitions(transitGet(tokensLib, 'sets') ?? tokensLib);
  const byName = new Map(definitions.map((set) => [set.name, set]));
  const activeThemePaths = collectActiveThemePaths(transitGet(tokensLib, 'active-themes'));

  const themes = collectThemes(transitGet(tokensLib, 'themes')).flatMap((theme) => {
    const entries = theme.sets.flatMap((setName) => byName.get(setName)?.entries ?? []);
    const css = entriesToCss(entries);
    return css
      ? [
          {
            id: theme.id,
            name: theme.name,
            css: css.css,
            tokenCount: css.tokenCount,
            kind: 'theme' as const,
            active: activeThemePaths.has(theme.path),
          },
        ]
      : [];
  });

  const sets = definitions.flatMap((set) => {
    const css = entriesToCss(set.entries);
    return css ? [{ id: `set:${set.id}`, name: set.name, css: css.css, tokenCount: css.tokenCount, kind: 'set' as const }] : [];
  });

  if (themes.length > 0) {
    return themes.sort((a, b) => a.name.localeCompare(b.name));
  }

  return sets.sort((a, b) => a.name.localeCompare(b.name));
}
