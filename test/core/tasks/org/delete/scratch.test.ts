import { strict as assert } from 'node:assert';
import { runTask } from '../../run-task.js';
import scratch from '../../../../../src/core/tasks/org/delete/scratch.js';

describe('org/delete/scratch', () => {
  it('calls org:delete:scratch with the alias', async () => {
    const { commands } = await runTask(scratch, { params: { alias: 'my-scratch' } });
    assert.equal(commands[0]?.id, 'org:delete:scratch');
    assert.ok(commands[0]?.argv.includes('my-scratch'));
    assert.ok(commands[0]?.argv.includes('--no-prompt'));
  });

  it('logs the deleted alias', async () => {
    const { logs } = await runTask(scratch, { params: { alias: 'my-scratch' } });
    assert.ok(logs[0]?.includes('my-scratch'));
  });
});
