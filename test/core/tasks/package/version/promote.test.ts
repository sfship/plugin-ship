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
import { runTask } from '../../run-task.js';
import promote from '../../../../../src/core/tasks/package/version/promote.js';
import { ExpectedError } from '../../../../../src/core/error.js';

describe('package/version/promote', () => {
  it('sets version-id output and logs on success', async () => {
    const { outputs, logs } = await runTask(promote, { params: { 'version-id': '04tAAA' } });
    assert.equal(outputs['version-id'], '04tAAA');
    assert.ok(logs.some((l) => l.includes('04tAAA') && l.includes('Promoted')));
  });

  it('throws ExpectedError with an actionable message for the propagation delay error', async () => {
    await assert.rejects(
      () =>
        runTask(promote, {
          params: { 'version-id': '04tAAA' },
          runCommand: async () => {
            throw new Error('The corresponding Package Version Id was not found');
          },
        }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes("can't be found by the Dev Hub yet")
    );
  });

  it('rethrows unrelated errors', async () => {
    await assert.rejects(
      () =>
        runTask(promote, {
          params: { 'version-id': '04tAAA' },
          runCommand: async () => {
            throw new Error('some other failure');
          },
        }),
      (e: unknown) => e instanceof Error && e.message === 'some other failure'
    );
  });
});
