import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import { ExpectedError } from '../../../../../src/core/error.js';
import { runTask } from '../../run-task.js';
import deployStart from '../../../../../src/core/tasks/project/deploy/start.js';

describe('project:deploy:start', () => {
  it('builds passthrough argv and reports success', async () => {
    const { logs, commands } = await runTask(deployStart, {
      params: { 'target-org': 'my-org', 'dry-run': true, wait: 10 },
      runCommand: async () => ({ success: true, files: [] }),
    });

    assert.deepEqual(commands, [
      {
        id: 'project:deploy:start',
        argv: ['--target-org', 'my-org', '--dry-run', '--wait', '10', '--source-dir', join('/proj', 'force-app')],
      },
    ]);
    assert.deepEqual(logs, ['Deployed successfully.']);
  });

  it('treats "No local changes to deploy" as a skip, not a failure', async () => {
    const { logs } = await runTask(deployStart, {
      runCommand: () => {
        throw new ExpectedError('No local changes to deploy.');
      },
    });

    assert.deepEqual(logs, ['Nothing to deploy — skipping.']);
  });

  it('throws a formatted ExpectedError listing the failed files', async () => {
    const files = [
      {
        fullName: 'Foo',
        type: 'ApexClass',
        state: 'Failed',
        filePath: 'classes/Foo.cls',
        lineNumber: 12,
        columnNumber: 3,
        error: 'unexpected token',
      },
      { fullName: 'Bar', type: 'ApexClass', state: 'Failed', filePath: 'classes/Bar.cls' },
      { fullName: 'Baz', type: 'ApexClass', state: 'Changed', filePath: 'classes/Baz.cls' },
    ];

    await assert.rejects(
      () => runTask(deployStart, { runCommand: async () => ({ success: false, files }) }),
      (err: unknown) => {
        assert.ok(err instanceof ExpectedError);
        assert.equal(err.message, 'Deploy failed:\n  classes/Foo.cls (12:3): unexpected token\n  classes/Bar.cls: ');
        return true;
      }
    );
  });

  it('re-throws non-skip command errors unchanged', async () => {
    await assert.rejects(
      () =>
        runTask(deployStart, {
          runCommand: () => {
            throw new ExpectedError('Org expired.');
          },
        }),
      /Org expired\./
    );
  });
});
