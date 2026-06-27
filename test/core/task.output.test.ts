/*
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
