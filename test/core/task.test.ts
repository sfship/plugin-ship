// Tests for task.ts, task.runner.ts, and task.output.ts
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { Store } from '@plugin-ship/core/store.js';
import { TaskRunner } from '../../src/core/task.runner.js';

const shipDir = resolve('test/core');

describe('TaskRunner.resolve', () => {
  it('loads a valid .mjs task from the tasks directory', async () => {
    const taskName = 'dev/mjs-task';
    const task = await new TaskRunner(shipDir).resolveTask(taskName);
    assert.equal(task.name, taskName);
  });

  it('loads a valid .js task from the tasks directory', async () => {
    const taskName = 'dev/js-task';
    const task = await new TaskRunner(shipDir).resolveTask(taskName);
    assert.equal(task.name, taskName);
  });

  it('throws when the task file does not exist', async () => {
    await assert.rejects(() => new TaskRunner('/nonexistent').resolveTask('unknown'));
  });

  it('throws when the module default export is not a valid task', async () => {
    await assert.rejects(() => new TaskRunner(shipDir).resolveTask('not-a-task'));
  });

  it('throws when the task file exists but fails to import', async () => {
    await assert.rejects(() => new TaskRunner(shipDir).resolveTask('broken-task'));
  });
});

describe('TaskRunner.list', () => {
  it('includes tasks from the tasks directory', () => {
    const tasks = new TaskRunner(shipDir).list();
    assert.ok(tasks.includes('dev/js-task'));
  });

  it('always includes built-in tasks', () => {
    const tasks = new TaskRunner('/nonexistent').list();
    assert.ok(tasks.includes('util/log'));
  });

  it('does not throw when the tasks directory does not exist', () => {
    assert.doesNotThrow(() => new TaskRunner('/nonexistent').list());
  });
});

describe('TaskOutput', () => {
  it('set and get own namespace', () => {
    const store = new Store();
    const output = store.getTaskOutput('step-a');
    output.set('foo', 'bar');
    assert.equal(output.get('foo'), 'bar');
  });

  it('get returns undefined for a key that was never set', () => {
    const store = new Store();
    const output = store.getTaskOutput('step-a');
    assert.equal(output.get('missing'), undefined);
  });

  it('get(stepId, key) reads another step via the store', () => {
    const store = new Store();
    const a = store.getTaskOutput('step-a');
    a.set('result', 42);
    const b = store.getTaskOutput('step-b');
    assert.equal(b.get('step-a', 'result'), 42);
  });

  it('get(stepId, key) returns undefined for an unregistered step', () => {
    const store = new Store();
    const b = store.getTaskOutput('step-b');
    assert.equal(b.get('step-a', 'key'), undefined);
  });
});
