import { ResultAsync } from 'neverthrow';

export function safePromise<T>(promise: Promise<T>) {
  return ResultAsync.fromPromise(promise, (e) =>
    e instanceof Error ? e : new Error('Unknown error'),
  );
}
