/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { strict as assert } from 'node:assert';
import { Store } from '../../src/core/flow.store.js';

describe('Store constructor', () => {
  it('pre-registers namespaces for each provided step', () => {
    const store = new Store({ 'step-a': {}, 'step-b': {} });
    store.set('step-a', 'key', 'value');
    assert.equal(store.getSteps()['step-a']?.['key'], 'value');
  });
});

describe('Store.get', () => {
  it('returns a value previously written with set', () => {
    const store = new Store();
    store.getTaskOutput('step-a'); // registers the namespace
    store.set('step-a', 'org', 'my-org');
    assert.equal(store.get('step-a', 'org'), 'my-org');
  });

  it('returns undefined for an unknown step', () => {
    const store = new Store();
    assert.equal(store.get('missing', 'key'), undefined);
  });
});

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

  it('returns null when a pure token references a missing value', () => {
    const store = new Store();
    assert.deepEqual(store.resolveParams({ x: '${{ params.missing }}' }, { params: {} }), { x: null });
  });

  it('returns null when a pure token references a missing step output', () => {
    const store = new Store();
    assert.deepEqual(store.resolveParams({ x: '${{ steps.missing.key }}' }, { steps: {} }), { x: null });
  });

  it('preserves surrounding text when a token in a mixed string is missing', () => {
    const store = new Store();
    assert.deepEqual(store.resolveParams({ msg: 'Error: ${{ steps.fail.error }}' }, { steps: {} }), { msg: 'Error: ' });
  });

  it('returns an empty object for empty params', () => {
    const store = new Store();
    assert.deepEqual(store.resolveParams({}, {}), {});
  });

  it('interpolates tokens within record values', () => {
    const store = new Store();
    assert.deepEqual(store.resolveParams({ tokens: { key: '${{ params.ns }}' } }, { params: { ns: 'my_ns' } }), {
      tokens: { key: 'my_ns' },
    });
  });

  it('reflects TaskOutput writes immediately in step interpolation', () => {
    const store = new Store();
    const output = store.getTaskOutput('step-a');
    output.set('org', 'my-scratch-org');
    assert.deepEqual(store.resolveParams({ target: '${{ steps.step-a.org }}' }, { steps: store.getSteps() }), {
      target: 'my-scratch-org',
    });
  });
});
