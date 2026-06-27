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
import install from '../../../../../src/core/tasks/package/install/index.js';

describe('package/install', () => {
  it('calls package:install with the version id', async () => {
    const { commands } = await runTask(install, { params: { 'version-id': '04tAAA' } });
    assert.equal(commands[0]?.id, 'package:install');
    assert.ok(commands[0]?.argv.includes('04tAAA'));
  });

  it('logs success with the version id', async () => {
    const { logs } = await runTask(install, { params: { 'version-id': '04tAAA' } });
    assert.ok(logs[0]?.includes('04tAAA'));
  });

  it('passes target-org when provided', async () => {
    const { commands } = await runTask(install, { params: { 'version-id': '04tAAA', 'target-org': 'my-sandbox' } });
    assert.ok(commands[0]?.argv.includes('my-sandbox'));
  });
});
