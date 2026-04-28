/**
 * Send a deliberately-wrong set-tokens-lib change to learn the schema from the
 * validation error. Reads PENPOT_TOKEN / PENPOT_FILE_ID from env. Prints the
 * server response.
 */
import { getFileMeta, getPenpotBase } from '../src/penpot-api.ts';
import { randomUUID } from 'node:crypto';

const token = process.env['PENPOT_TOKEN']!;
const fileId = process.env['PENPOT_FILE_ID']!;

const meta = await getFileMeta(token, fileId);

// Transit-JSON minimal encoding: a map is encoded as ["^ ", k1, v1, k2, v2, ...]
// where keywords are encoded as `"~:name"` and plain strings stay as `"name"`.
const tEntries = (...kv: unknown[]): unknown[] => ['^ ', ...kv];

const body = tEntries(
  '~:id', fileId,
  '~:revn', meta.revn,
  '~:vern', meta.vern,
  '~:session-id', randomUUID(),
  '~:features', [
    'design-tokens/v1',
    'fdata/objects-map',
    'components/v2',
    'fdata/path-data',
    'fdata/shape-data-type',
    'variants/v1',
    'layout/grid',
    'styles/v2',
    'plugins/runtime',
  ],
  '~:changes', [
    tEntries(
      '~:type', '~:set-tokens-lib',
      '~:tokens-lib', tEntries(
        // String keys here (token set name + token names + $type/$value).
        'theme', tEntries(
          'primary', tEntries(
            '$type', 'color',
            '$value', '#2E51C4',
          ),
        ),
      ),
    ),
  ],
);

const res = await fetch(`${getPenpotBase()}/api/rpc/command/update-file`, {
  method: 'POST',
  headers: {
    Authorization: `Token ${token}`,
    'Content-Type': 'application/transit+json',
    Accept: 'application/transit+json',
  },
  body: JSON.stringify(body),
});
console.error('Status:', res.status);
const text = await res.text();
console.log(text);
