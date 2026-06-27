import { strict as assert } from 'node:assert';
import { runTask } from '../run-task.js';
import log from '../../../../src/core/tasks/util/log.js';

describe('util/log', () => {
  it('logs the message param', async () => {
    const { logs } = await runTask(log, { params: { message: 'hello world' } });
    assert.deepEqual(logs, ['hello world']);
  });
});
