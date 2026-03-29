import { strict as assert } from 'node:assert';
import { Store } from '@plugin-ship/core/store.js';

describe('Store.resolveParams', () => {
  it('returns non-string values unchanged', () => {
    const store = new Store();
    assert.deepEqual(store.resolveParams({ count: 42, flag: true }, {}), { count: 42, flag: true });
  });

  it('returns a plain string unchanged', () => {
    const store = new Store();
    assert.deepEqual(store.resolveParams({ msg: 'hello' }, {}), { msg: 'hello' });
  });

  it('interpolates a ${{ params.x }} token', () => {
    const store = new Store();
    assert.deepEqual(store.resolveParams({ env: '${{ params.env }}' }, { params: { env: 'production' } }), {
      env: 'production',
    });
  });

  it('interpolates a ${{ steps.<id>.<key> }} token', () => {
    const store = new Store();
    const output = store.getTaskOutput('create-org');
    output.set('targetOrg', 'test-org');
    assert.deepEqual(store.resolveParams({ org: '${{ steps.create-org.targetOrg }}' }, { steps: store.getSteps() }), {
      org: 'test-org',
    });
  });

  it('interpolates multiple tokens in a single string', () => {
    const store = new Store();
    assert.deepEqual(
      store.resolveParams({ label: '${{ params.org }}-${{ params.env }}' }, { params: { org: 'myorg', env: 'dev' } }),
      { label: 'myorg-dev' }
    );
  });

  it('returns null when the referenced value does not exist', () => {
    const store = new Store();
    assert.deepEqual(store.resolveParams({ x: '${{ params.missing }}' }, { params: {} }), { x: null });
  });

  it('returns null when the referenced step output does not exist', () => {
    const store = new Store();
    assert.deepEqual(store.resolveParams({ x: '${{ steps.missing.key }}' }, { steps: {} }), { x: null });
  });

  it('returns an empty object for empty params', () => {
    const store = new Store();
    assert.deepEqual(store.resolveParams({}, {}), {});
  });
});

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

  it('writes are visible to resolveParams immediately', () => {
    const store = new Store();
    const output = store.getTaskOutput('step-a');
    output.set('org', 'my-scratch-org');
    assert.deepEqual(store.resolveParams({ target: '${{ steps.step-a.org }}' }, { steps: store.getSteps() }), {
      target: 'my-scratch-org',
    });
  });
});
