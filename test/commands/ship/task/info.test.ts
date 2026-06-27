/* eslint-disable class-methods-use-this */
import { strict as assert } from 'node:assert';
import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx, stubUx } from '@salesforce/sf-plugins-core';
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
let resolveTaskResult: Task = baseTask;

const TaskInfo = await mockCommand('ship/task/info.js', {
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
});

describe('ship task info', () => {
  const $$ = new TestContext();
  let stubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(() => {
    stubs = stubSfCommandUx($$.SANDBOX);
    stubUx($$.SANDBOX);
    resolvedTaskName = undefined;
    resolveTaskResult = { ...baseTask };
  });

  it('resolves the task by name from args', async () => {
    await TaskInfo.run(['git/release/create', '--config', 'ship.yml']);
    assert.equal(resolvedTaskName, 'git/release/create');
  });

  it('shows the params section when the task has params', async () => {
    resolveTaskResult = {
      ...baseTask,
      params: [{ name: 'tag', type: 'string', required: true, description: 'Git tag' }],
    };
    await TaskInfo.run(['git/release/create', '--config', 'ship.yml']);
    assert.ok(stubs.styledHeader.calledWith('Task Params'));
  });

  it('omits the params section when the task has no params', async () => {
    await TaskInfo.run(['git/release/create', '--config', 'ship.yml']);
    assert.ok(!stubs.styledHeader.calledWith('Task Params'));
  });

  it('shows the outputs section when the task has outputs', async () => {
    resolveTaskResult = {
      ...baseTask,
      outputs: [{ name: 'release-url', type: 'string', description: 'The release URL' }],
    };
    await TaskInfo.run(['git/release/create', '--config', 'ship.yml']);
    assert.ok(stubs.styledHeader.calledWith('Task Outputs'));
  });

  it('omits the outputs section when the task has no outputs', async () => {
    await TaskInfo.run(['git/release/create', '--config', 'ship.yml']);
    assert.ok(!stubs.styledHeader.calledWith('Task Outputs'));
  });

  it('includes only required params in the example command tip', async () => {
    resolveTaskResult = {
      ...baseTask,
      params: [
        { name: 'tag', type: 'string', required: true, description: 'Git tag' },
        { name: 'draft', type: 'boolean', required: false, description: 'Mark as draft' },
      ],
    };
    await TaskInfo.run(['git/release/create', '--config', 'ship.yml']);
    const tip = stubs.log.args.find(([a]) => String(a ?? '').includes('sf ship task run'));
    assert.ok(tip, 'expected a log call containing the example command tip');
    assert.ok(String(tip[0]).includes('--param tag=<tag>'));
    assert.ok(!String(tip[0]).includes('--param draft='));
  });
});
