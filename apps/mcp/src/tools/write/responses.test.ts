import { describe, expect, it } from 'vitest';
import { rejected } from './responses';

describe('rejected', () => {
  it('flags the result as an error and keeps the message', () => {
    expect(rejected('# Shape not found')).toEqual({
      content: [{ type: 'text', text: '# Shape not found' }],
      isError: true,
    });
  });
});
