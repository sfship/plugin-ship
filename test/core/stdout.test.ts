import { strict as assert } from 'node:assert';
import { withSuppressedStdout } from '../../src/core/stdout.js';

describe('withSuppressedStdout', () => {
  it('returns the value from the callback', async () => {
    const result = await withSuppressedStdout(async () => 42);
    assert.equal(result, 42);
  });

  it('suppresses stdout and stderr during execution', async () => {
    const written: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    await withSuppressedStdout(async () => {
      process.stdout.write('suppressed');
      process.stderr.write('suppressed');
      written.push('wrote');
    });
    process.stdout.write = original;
    assert.deepEqual(written, ['wrote']);
  });

  it('restores stdout and stderr after execution', async () => {
    const stub = (): boolean => true;
    process.stdout.write = stub as typeof process.stdout.write;
    await withSuppressedStdout(async () => {});
    // eslint-disable-next-line @typescript-eslint/unbound-method
    assert.equal(process.stdout.write, stub);
  });

  it('restores stdout and stderr even if the callback throws', async () => {
    const stub = (): boolean => true;
    process.stdout.write = stub as typeof process.stdout.write;
    await assert.rejects(() =>
      withSuppressedStdout(async () => {
        throw new Error('boom');
      })
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    assert.equal(process.stdout.write, stub);
  });
});
