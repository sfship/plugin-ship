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
import esmock from 'esmock';
import { runTask } from '../../run-task.js';
import tree from '../../../../../src/core/tasks/data/import/tree.js';
import type { Task } from '../../../../../src/core/task.definition.schema.js';

describe('data/import/tree', () => {
  it('skips when neither plan nor files is provided and no default plan exists', async () => {
    const { commands, logs } = await runTask(tree, {});
    assert.equal(commands.length, 0);
    assert.ok(logs[0]?.includes('skipping'));
  });

  it('calls data:import:tree with a plan file', async () => {
    const { commands } = await runTask(tree, { params: { plan: 'data/my-plan.json' } });
    assert.equal(commands[0]?.id, 'data:import:tree');
    assert.ok(commands[0]?.argv.includes('data/my-plan.json'));
  });

  it('calls data:import:tree with files', async () => {
    const { commands } = await runTask(tree, { params: { files: 'data/accounts.json' } });
    assert.equal(commands[0]?.id, 'data:import:tree');
    assert.ok(commands[0]?.argv.includes('data/accounts.json'));
  });

  it('passes target-org when provided', async () => {
    const { commands } = await runTask(tree, { params: { plan: 'data/plan.json', 'target-org': 'my-sandbox' } });
    assert.ok(commands[0]?.argv.includes('my-sandbox'));
  });

  it('logs success', async () => {
    const { logs } = await runTask(tree, { params: { plan: 'data/plan.json' } });
    assert.ok(logs[0]?.includes('Imported'));
  });

  // — default `.ship/data/plan.json` convention —

  it('falls back to .ship/data/plan.json when it exists and no params are given', async () => {
    const { default: treeWithPlan }: { default: Pick<Task, 'run'> } = await esmock(
      '../../../../../src/core/tasks/data/import/tree.js',
      {
        '../../../../../src/core/file.js': {
          pathExists: () => true,
        },
      }
    );

    const { commands, logs } = await runTask(treeWithPlan, { context: { shipDir: '/proj/.ship' } });
    assert.equal(commands[0]?.id, 'data:import:tree');
    const planIndex = commands[0]?.argv.indexOf('--plan') ?? -1;
    assert.notEqual(planIndex, -1);
    assert.ok(commands[0]?.argv[planIndex + 1]?.endsWith('plan.json'));
    assert.ok(logs.some((line) => line.includes('plan.json')));
  });

  it('explicit files take precedence over the default plan', async () => {
    const { commands } = await runTask(tree, { params: { files: 'data/accounts.json' } });
    assert.ok(commands[0]?.argv.includes('data/accounts.json'));
    assert.ok(!commands[0]?.argv.includes('--plan'));
  });
});
