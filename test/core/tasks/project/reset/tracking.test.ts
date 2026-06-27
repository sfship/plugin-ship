import { strict as assert } from 'node:assert';
import { runTask } from '../../run-task.js';
import tracking from '../../../../../src/core/tasks/project/reset/tracking.js';

describe('project/reset/tracking', () => {
  it('calls project:reset:tracking', async () => {
    const { commands } = await runTask(tracking);
    assert.equal(commands[0]?.id, 'project:reset:tracking');
  });

  it('logs the resolved alias when target-org is provided', async () => {
    const { logs } = await runTask(tracking, { params: { 'target-org': 'my-sandbox' } });
    assert.ok(logs[0]?.includes('my-sandbox'));
  });

  it('logs "default org" when no target-org is provided', async () => {
    const { logs } = await runTask(tracking);
    assert.ok(logs[0]?.includes('default org'));
  });
});
