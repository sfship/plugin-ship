import { strict as assert } from 'node:assert';
import { Store } from '@plugin-ship/core/store.js';

describe('Store', () => {
  it('returns undefined for a key that has not been set', () => {
    const store = new Store();
    assert.equal(store.get('missing'), undefined);
  });

  it('returns a value that was set', () => {
    const store = new Store();
    store.set('key', 'value');
    assert.equal(store.get('key'), 'value');
  });

  it('overwrites an existing value', () => {
    const store = new Store();
    store.set('key', 'first');
    store.set('key', 'second');
    assert.equal(store.get('key'), 'second');
  });

  it('stores values independently under different keys', () => {
    const store = new Store();
    store.set('a', 1);
    store.set('b', 2);
    assert.equal(store.get('a'), 1);
    assert.equal(store.get('b'), 2);
  });
});
