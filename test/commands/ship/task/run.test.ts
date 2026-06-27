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
import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { mockCommand } from '../../mock-command.js';
import type { Task } from '../../../../src/core/task.definition.schema.js';

const baseTask: Task = {
  name: 'git/release/create',
  description: 'Creates a GitHub release',
  params: [],
  outputs: [],
  run: async () => {},
};

let resolvedTaskName: string | undefined;
let taskRunCalled = false;
let resolveTaskResult: Task = baseTask;
let handleErrorArgs: [unknown, (msg: string) => void] | undefined;

const TaskRun = await mockCommand('ship/task/run.js', {
  'config.loader.js': {
    loadConfig: () => ({ project: { slug: 'test' }, dir: '.ship' }),
    resolveProjectPaths: () => ({ projectDir: '/proj', shipDir: '/proj/.ship' }),
  },
  'task.registry.js': {
    TaskRegistry: class {
      public async resolveTask(name: string): Promise<Task> {
        resolvedTaskName = name;
        return resolveTaskResult;
      }
    },
  },
  'error.js': {
    handleError: (err: unknown, log: (msg: string) => void) => {
      handleErrorArgs = [err, log];
      log((err as Error).message);
    },
  },
});

describe('ship task run', () => {
  const $$ = new TestContext();
  let stubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(() => {
    stubs = stubSfCommandUx($$.SANDBOX);
    resolvedTaskName = undefined;
    taskRunCalled = false;
    handleErrorArgs = undefined;
    resolveTaskResult = {
      ...baseTask,
      run: async () => {
        taskRunCalled = true;
      },
    };
  });

  it('resolves the task by name from args', async () => {
    await TaskRun.run(['git/release/create', '--config', 'ship.yml']);
    assert.equal(resolvedTaskName, 'git/release/create');
  });

  it('runs the task', async () => {
    await TaskRun.run(['git/release/create', '--config', 'ship.yml']);
    assert.ok(taskRunCalled);
  });

  it('passes parsed --param flags to the task context', async () => {
    let receivedParams: Record<string, unknown> | undefined;
    resolveTaskResult = {
      ...baseTask,
      params: [{ name: 'tag', type: 'string', required: false, description: 'Git tag' }],
      run: async ({ params }) => {
        receivedParams = params;
      },
    };
    await TaskRun.run(['git/release/create', '--config', 'ship.yml', '--param', 'tag=v1.0.0']);
    assert.equal(receivedParams?.['tag'], 'v1.0.0');
  });

  it('handles an error thrown by the task', async () => {
    resolveTaskResult = {
      ...baseTask,
      run: async () => {
        throw new Error('task failed');
      },
    };
    await TaskRun.run(['git/release/create', '--config', 'ship.yml']);
    assert.ok(handleErrorArgs, 'expected handleError to be called');
    assert.ok(stubs.log.calledWith('task failed'));
  });
});
