import { strict as assert } from 'node:assert';
import { runTask } from '../run-task.js';
import deploy from '../../../../src/core/tasks/metadata/deploy.js';

describe('metadata/deploy', () => {
  it('calls project:deploy:start with the source dir', async () => {
    const { commands } = await runTask(deploy, { params: { 'source-dir': 'my-app' } });
    assert.equal(commands[0]?.id, 'project:deploy:start');
    assert.ok(commands[0]?.argv.some((a) => a.includes('my-app')));
  });

  it('defaults source dir to force-app', async () => {
    const { commands } = await runTask(deploy, {});
    assert.ok(commands[0]?.argv.some((a) => a.includes('force-app')));
  });

  it('passes target-org when provided', async () => {
    const { commands } = await runTask(deploy, { params: { 'target-org': 'my-sandbox' } });
    assert.ok(commands[0]?.argv.includes('my-sandbox'));
  });

  it('omits target-org args when not provided', async () => {
    const { commands } = await runTask(deploy, {});
    assert.ok(!commands[0]?.argv.includes('--target-org'));
  });

  it('logs success', async () => {
    const { logs } = await runTask(deploy, {});
    assert.ok(logs[0]?.includes('Deployed'));
  });
});
