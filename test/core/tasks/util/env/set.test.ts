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
import { runTask } from '../../run-task.js';
import envSet from '../../../../../src/core/tasks/util/env/set.js';

const KEYS = ['SHIP_TEST_SET_A', 'SHIP_TEST_SET_B'];

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe('util/env/set', () => {
  it('sets each variable from the vars record', async () => {
    await runTask(envSet, { params: { vars: { SHIP_TEST_SET_A: 'ns__', SHIP_TEST_SET_B: 'c' } } });
    assert.equal(process.env['SHIP_TEST_SET_A'], 'ns__');
    assert.equal(process.env['SHIP_TEST_SET_B'], 'c');
  });

  it('sets empty string values', async () => {
    await runTask(envSet, { params: { vars: { SHIP_TEST_SET_A: '' } } });
    assert.equal(process.env['SHIP_TEST_SET_A'], '');
  });

  it('overwrites an existing value', async () => {
    process.env['SHIP_TEST_SET_A'] = 'old';
    await runTask(envSet, { params: { vars: { SHIP_TEST_SET_A: 'new' } } });
    assert.equal(process.env['SHIP_TEST_SET_A'], 'new');
  });

  it('logs variable names but not values', async () => {
    const { logs } = await runTask(envSet, { params: { vars: { SHIP_TEST_SET_A: 'secret-value' } } });
    assert.ok(logs.some((l) => l.includes('SHIP_TEST_SET_A')));
    assert.equal(
      logs.some((l) => l.includes('secret-value')),
      false
    );
  });

  it('is a no-op for an empty record', async () => {
    const { logs } = await runTask(envSet, { params: { vars: {} } });
    assert.equal(logs.length, 0);
  });
});
