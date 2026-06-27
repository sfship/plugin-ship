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
