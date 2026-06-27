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
/* eslint-disable class-methods-use-this */

import { strict as assert } from 'node:assert';
import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { mockCommand } from '../../mock-command.js';

let listedTasks: string[] = [];
let renderTreeArg: string[] | undefined;

const TaskList = await mockCommand('ship/task/list.js', {
  'config.loader.js': {
    loadConfig: () => ({ project: { slug: 'test' }, dir: '.ship' }),
    resolveProjectPaths: () => ({ projectDir: '/proj', shipDir: '/proj/.ship' }),
  },
  'task.registry.js': {
    TaskRegistry: class {
      public list(): string[] {
        return listedTasks;
      }
    },
  },
  'tree.js': {
    renderTree: (tasks: string[]) => {
      renderTreeArg = tasks;
      return tasks.join('\n');
    },
  },
});

describe('ship task list', () => {
  const $$ = new TestContext();
  let stubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(() => {
    stubs = stubSfCommandUx($$.SANDBOX);
    listedTasks = [];
    renderTreeArg = undefined;
  });

  it('renders the task list', async () => {
    listedTasks = ['git/release/create', 'org/create/scratch'];
    await TaskList.run(['--config', 'ship.yml']);
    assert.deepEqual(renderTreeArg, ['git/release/create', 'org/create/scratch']);
    assert.ok(stubs.log.calledWith('git/release/create\norg/create/scratch'));
  });

  it('shows the Task List header', async () => {
    await TaskList.run(['--config', 'ship.yml']);
    assert.ok(stubs.styledHeader.calledWith('Task List'));
  });

  it('logs the tip for viewing task details', async () => {
    await TaskList.run(['--config', 'ship.yml']);
    const tip = stubs.log.args.find(([a]) => String(a ?? '').includes('sf ship task info'));
    assert.ok(tip, 'expected a log call containing the task info tip');
  });
});
