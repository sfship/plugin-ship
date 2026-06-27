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
import tracking from '../../../../../src/core/tasks/project/reset/tracking.js';

describe('project/reset/tracking', () => {
  it('calls project:reset:tracking', async () => {
    const { commands } = await runTask(tracking);
    assert.equal(commands[0]?.id, 'project:reset:tracking');
  });

  it('logs the resolved alias when target-org is provided', async () => {
    const { logs } = await runTask(tracking, { params: { 'target-org': 'my-sandbox' } });
    assert.ok(logs[0]?.includes('my-sandbox'));
  });

  it('logs "default org" when no target-org is provided', async () => {
    const { logs } = await runTask(tracking);
    assert.ok(logs[0]?.includes('default org'));
  });
});
