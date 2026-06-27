import { strict as assert } from 'node:assert';
import { runTask } from '../../run-task.js';
import install from '../../../../../src/core/tasks/package/install/index.js';

describe('package/install', () => {
  it('calls package:install with the version id', async () => {
    const { commands } = await runTask(install, { params: { 'version-id': '04tAAA' } });
    assert.equal(commands[0]?.id, 'package:install');
    assert.ok(commands[0]?.argv.includes('04tAAA'));
  });

  it('logs success with the version id', async () => {
    const { logs } = await runTask(install, { params: { 'version-id': '04tAAA' } });
    assert.ok(logs[0]?.includes('04tAAA'));
  });

  it('passes target-org when provided', async () => {
    const { commands } = await runTask(install, { params: { 'version-id': '04tAAA', 'target-org': 'my-sandbox' } });
    assert.ok(commands[0]?.argv.includes('my-sandbox'));
  });
});
