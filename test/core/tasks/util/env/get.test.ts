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
import envGet from '../../../../../src/core/tasks/util/env/get.js';

const KEY = 'SHIP_TEST_GET_A';

afterEach(() => {
  delete process.env[KEY];
});

describe('util/env/get', () => {
  it('outputs the value and exists=true when set', async () => {
    process.env[KEY] = 'ns__';
    const { outputs } = await runTask(envGet, { params: { name: KEY } });
    assert.equal(outputs['value'], 'ns__');
    assert.equal(outputs['exists'], true);
  });

  it('outputs empty string and exists=false when unset', async () => {
    const { outputs } = await runTask(envGet, { params: { name: KEY } });
    assert.equal(outputs['value'], '');
    assert.equal(outputs['exists'], false);
  });

  it('treats an empty string value as set', async () => {
    process.env[KEY] = '';
    const { outputs } = await runTask(envGet, { params: { name: KEY } });
    assert.equal(outputs['value'], '');
    assert.equal(outputs['exists'], true);
  });
});
