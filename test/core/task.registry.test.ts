import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import esmock from 'esmock';
import { TaskRegistry } from '../../src/core/task.registry.js';

const shipDir = resolve('test/core');

describe('TaskRegistry.resolve', () => {
  it('loads a valid .mjs task from the tasks directory', async () => {
    const taskName = 'dev/mjs-task';
    const task = await new TaskRegistry(shipDir).resolveTask(taskName);
    assert.equal(task.name, taskName);
  });

  it('loads a valid .js task from the tasks directory', async () => {
    const taskName = 'dev/js-task';
    const task = await new TaskRegistry(shipDir).resolveTask(taskName);
    assert.equal(task.name, taskName);
  });

  it('throws when the task file does not exist', async () => {
    await assert.rejects(() => new TaskRegistry('/nonexistent').resolveTask('unknown'));
  });

  it('throws when the module default export is not a valid task', async () => {
    await assert.rejects(() => new TaskRegistry(shipDir).resolveTask('not-a-task'));
  });

  it('throws when the task file exists but fails to import', async () => {
    await assert.rejects(() => new TaskRegistry(shipDir).resolveTask('broken-task'));
  });
});

describe('TaskRegistry.list', () => {
  it('includes tasks from the tasks directory', () => {
    const tasks = new TaskRegistry(shipDir).list();
    assert.ok(tasks.includes('dev/js-task'));
  });

  it('always includes built-in tasks', () => {
    const tasks = new TaskRegistry('/nonexistent').list();
    assert.ok(tasks.includes('util/log'));
  });

  it('does not throw when the tasks directory does not exist', () => {
    assert.doesNotThrow(() => new TaskRegistry('/nonexistent').list());
  });

  it('rethrows non-ENOENT errors from the tasks directory scan', async () => {
    const permError = Object.assign(new Error('EPERM'), { code: 'EPERM' });
    const { TaskRegistry: MockedRegistry }: { TaskRegistry: typeof TaskRegistry } = await esmock(
      '../../src/core/task.registry.js',
      {
        '../../src/core/file.js': {
          listDir: () => {
            throw permError;
          },
        },
      }
    );
    assert.throws(
      () => new MockedRegistry('/ship'),
      (err) => err === permError
    );
  });
});
