import { strict as assert } from 'node:assert';
import { runTask } from '../../run-task.js';
import tree from '../../../../../src/core/tasks/data/import/tree.js';

describe('data/import/tree', () => {
  it('skips when neither plan nor files is provided', async () => {
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
});
