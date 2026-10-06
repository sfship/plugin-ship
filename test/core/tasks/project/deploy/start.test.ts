/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import { ExpectedError } from '../../../../../src/core/error.js';
import { runTask } from '../../run-task.js';
import deployStart from '../../../../../src/core/tasks/project/deploy/start.js';

describe('project:deploy:start', () => {
  it('runs a tracked deploy when no source-dir is given', async () => {
    const { logs, commands } = await runTask(deployStart, {
      runCommand: async () => ({ success: true, files: [] }),
    });

    const [call] = commands;
    assert.equal(call.id, 'project:deploy:start');
    assert.ok(!call.argv.includes('--source-dir'));
    assert.deepEqual(logs, ['Deployed successfully.']);
  });

  it('resolves source-dir against the project directory', async () => {
    const { commands } = await runTask(deployStart, {
      params: { 'source-dir': 'unpackaged/post' },
      runCommand: async () => ({ success: true, files: [] }),
    });

    const { argv } = commands[0];
    assert.equal(argv[argv.indexOf('--source-dir') + 1], join('/proj', 'unpackaged/post'));
  });

  it('skips when a tracked deploy has no local changes', async () => {
    const { logs } = await runTask(deployStart, {
      runCommand: async () => ({ status: 'Nothing to deploy', files: [] }),
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
        assert.ok(err.message.includes('classes/Foo.cls'));
        assert.ok(err.message.includes('12:3'));
        assert.ok(err.message.includes('unexpected token'));
        assert.ok(err.message.includes('classes/Bar.cls'));
        assert.ok(!err.message.includes('classes/Baz.cls'));
        return true;
      }
    );
  });

  it('re-throws command errors unchanged', async () => {
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
