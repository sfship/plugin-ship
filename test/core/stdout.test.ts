import { strict as assert } from 'node:assert';
import { withSuppressedStdout } from '../../src/core/stdout.js';

describe('withSuppressedStdout', () => {
  let savedStdoutWrite: typeof process.stdout.write;
  let savedStderrWrite: typeof process.stderr.write;

  beforeEach(() => {
    savedStdoutWrite = process.stdout.write.bind(process.stdout);
    savedStderrWrite = process.stderr.write.bind(process.stderr);
  });

  afterEach(() => {
    process.stdout.write = savedStdoutWrite;
    process.stderr.write = savedStderrWrite;
  });

  it('returns the value from the callback', async () => {
    const result = await withSuppressedStdout(async () => 42);
    assert.equal(result, 42);
  });

  it('suppresses stdout and stderr during execution', async () => {
    const written: string[] = [];
    await withSuppressedStdout(async () => {
      process.stdout.write('suppressed');
      process.stderr.write('suppressed');
      written.push('wrote');
    });
    assert.deepEqual(written, ['wrote']);
  });

  it('restores stdout and stderr after execution', async () => {
    const written: string[] = [];
    const capture = (s: unknown): boolean => {
      written.push(String(s));
      return true;
    };
    process.stdout.write = capture as typeof process.stdout.write;
    process.stderr.write = capture as typeof process.stderr.write;
    await withSuppressedStdout(async () => {});
    process.stdout.write('after-stdout');
    process.stderr.write('after-stderr');
    assert.ok(written.includes('after-stdout'));
    assert.ok(written.includes('after-stderr'));
  });

  it('restores stdout and stderr even if the callback throws', async () => {
    const written: string[] = [];
    const capture = (s: unknown): boolean => {
      written.push(String(s));
      return true;
    };
    process.stdout.write = capture as typeof process.stdout.write;
    process.stderr.write = capture as typeof process.stderr.write;
    await assert.rejects(() =>
      withSuppressedStdout(async () => {
        throw new Error('boom');
      })
    );
    process.stdout.write('after-stdout');
    process.stderr.write('after-stderr');
    assert.ok(written.includes('after-stdout'));
    assert.ok(written.includes('after-stderr'));
  });
});
