import { strict as assert } from 'node:assert';
import { Store } from '../../src/core/flow.store.js';

describe('TaskOutput', () => {
  it('set and get own namespace', () => {
    const store = new Store();
    const output = store.getTaskOutput('step-a');
    output.set('foo', 'bar');
    assert.equal(output.get('foo'), 'bar');
  });

  it('get returns undefined for a key that was never set', () => {
    const store = new Store();
    const output = store.getTaskOutput('step-a');
    assert.equal(output.get('missing'), undefined);
  });

  it('get(stepId, key) reads another step via the store', () => {
    const store = new Store();
    const a = store.getTaskOutput('step-a');
    a.set('result', 42);
    const b = store.getTaskOutput('step-b');
    assert.equal(b.get('step-a', 'result'), 42);
  });

  it('get(stepId, key) returns undefined for an unregistered step', () => {
    const store = new Store();
    const b = store.getTaskOutput('step-b');
    assert.equal(b.get('step-a', 'key'), undefined);
  });
});
