import { strict as assert } from 'node:assert';
import { asError } from '@plugin-ship/core/error.utils.js';

describe('asError', () => {
  it('returns thrown Errors as is', () => {
    const original = new Error('test');
    assert.equal(asError(original), original); // same instance
  });
  it('wraps a non-Error in a new Error', () => {
    assert.equal(asError('oops').message, 'oops');
  });
});
