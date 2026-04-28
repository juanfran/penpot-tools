/**
 * Minimal Transit-JSON encoder for the bits of `update-file` that regular JSON
 * can't represent. Penpot's JSON decoder strips `$` from object keys, so token
 * payloads (DTCG `$type` / `$value`) require Transit. The full Transit spec is
 * larger than what we need — we encode the subset that maps cleanly onto our
 * outgoing change shapes.
 *
 * Conventions for callers:
 *   - Reserved Transit values are wrapped via `tk()` (keyword), `tu()` (UUID),
 *     `tset()` (set). Plain strings stay strings.
 *   - Maps are encoded with the cache-marker form `["^ ", k, v, ...]`.
 *
 * If a future requirement needs Transit's full feature set (instants, tagged
 * extensions, caching codes), reach for `transit-js` instead — but for one
 * change type the standalone implementation keeps deps lean.
 */

const TRANSIT_TAG = '__transit__';

interface Tagged<T extends string> {
  readonly [TRANSIT_TAG]: T;
  readonly value: unknown;
}

function tagged<T extends string>(tag: T, value: unknown): Tagged<T> {
  return { [TRANSIT_TAG]: tag, value } as Tagged<T>;
}

/** Tag a Clojure-keyword value (rendered as `~:name`). */
export function tk(name: string): Tagged<'kw'> {
  return tagged('kw', name);
}

/** Tag a UUID value (rendered as `~u<uuid>`). */
export function tu(uuid: string): Tagged<'uuid'> {
  return tagged('uuid', uuid);
}

/** Tag a Clojure set value (rendered as `["~#set", [...]]`). */
export function tset(items: readonly unknown[]): Tagged<'set'> {
  return tagged('set', items);
}

/**
 * Pre-encoded raw Transit fragment — escape hatch for values where the caller
 * already knows the JSON-string-encoded form (e.g. preserved literals).
 */
export function traw(jsonScalar: string): Tagged<'raw'> {
  return tagged('raw', jsonScalar);
}

function isTagged(v: unknown): v is Tagged<string> {
  return typeof v === 'object' && v !== null && TRANSIT_TAG in v;
}

function escapeStringValue(s: string): string {
  // Transit needs to escape strings that themselves start with `~`, `^`, or
  // `\`` so they can't be confused with tagged forms. We never produce those
  // organically, but better to be safe.
  if (s.length === 0) return s;
  const first = s.charCodeAt(0);
  if (first === 126 /* ~ */ || first === 94 /* ^ */ || first === 96 /* ` */) {
    return '~' + s;
  }
  return s;
}

/** Encode an arbitrary JS value into the Transit JSON tree (still a JS value). */
export function encode(value: unknown): unknown {
  if (value === null || value === undefined) return null;

  if (isTagged(value)) {
    const tag = value[TRANSIT_TAG];
    if (tag === 'kw') return '~:' + (value.value as string);
    if (tag === 'uuid') return '~u' + (value.value as string);
    if (tag === 'set') return ['~#set', (value.value as readonly unknown[]).map(encode)];
    if (tag === 'raw') return value.value;
    throw new Error(`Unknown transit tag: ${tag as string}`);
  }

  if (typeof value === 'string') return escapeStringValue(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (Array.isArray(value)) return value.map(encode);

  if (typeof value === 'object') {
    const out: unknown[] = ['^ '];
    for (const [k, v] of Object.entries(value)) {
      // Object literal keys come in two flavours: bare camelCase (legacy from
      // our existing JSON-shaped changes) and `:foo-bar` Transit keywords. We
      // detect the latter by a leading `:` to avoid double-tagging.
      let encodedKey: unknown;
      if (k.startsWith(':')) encodedKey = '~:' + k.slice(1);
      else encodedKey = encode(k);
      out.push(encodedKey, encode(v));
    }
    return out;
  }

  throw new Error(`Cannot encode value of type ${typeof value}`);
}

export function toTransitJson(value: unknown): string {
  return JSON.stringify(encode(value));
}
