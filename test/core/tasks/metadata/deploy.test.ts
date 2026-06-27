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
import { runTask } from '../run-task.js';
import deploy from '../../../../src/core/tasks/metadata/deploy.js';

describe('metadata/deploy', () => {
  it('calls project:deploy:start with the source dir', async () => {
    const { commands } = await runTask(deploy, { params: { 'source-dir': 'my-app' } });
    assert.equal(commands[0]?.id, 'project:deploy:start');
    assert.ok(commands[0]?.argv.some((a) => a.includes('my-app')));
  });

  it('defaults source dir to force-app', async () => {
    const { commands } = await runTask(deploy, {});
    assert.ok(commands[0]?.argv.some((a) => a.includes('force-app')));
  });

  it('passes target-org when provided', async () => {
    const { commands } = await runTask(deploy, { params: { 'target-org': 'my-sandbox' } });
    assert.ok(commands[0]?.argv.includes('my-sandbox'));
  });

  it('omits target-org args when not provided', async () => {
    const { commands } = await runTask(deploy, {});
    assert.ok(!commands[0]?.argv.includes('--target-org'));
  });

  it('logs success', async () => {
    const { logs } = await runTask(deploy, {});
    assert.ok(logs[0]?.includes('Deployed'));
  });
});
