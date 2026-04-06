import { strict as assert } from 'node:assert';
import { asError, handleError, ExpectedError } from '@plugin-ship/core/error.utils.js';

describe('asError', () => {
  it('returns thrown Errors as is', () => {
    const original = new Error('test');
    assert.equal(asError(original), original); // same instance
  });
  it('wraps a non-Error in a new Error', () => {
    assert.equal(asError('oops').message, 'oops');
  });
});

describe('handleError', () => {
  it('logs the message and exits for ExpectedError', () => {
    const logged: string[] = [];
    const original = process.exit.bind(process);
    process.exit = (() => {
      throw new Error('exit');
    }) as never;
    try {
      assert.throws(() => handleError(new ExpectedError('bad input'), (msg) => logged.push(msg)), /exit/);
      assert.deepEqual(logged, ['bad input']);
    } finally {
      process.exit = original as never;
    }
  });

  it('rethrows unexpected errors', () => {
    const original = new Error('crash');
    assert.throws(
      () => handleError(original, () => {}),
      (err) => err === original
    );
  });
});
