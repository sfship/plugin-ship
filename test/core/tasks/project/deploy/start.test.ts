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
  it('targets the deploy command and defaults source-dir to force-app', async () => {
    const { logs, commands } = await runTask(deployStart, {
      runCommand: async () => ({ success: true, files: [] }),
    });

    const [call] = commands;
    assert.equal(call.id, 'project:deploy:start');
    assert.ok(call.argv.includes(join('/proj', 'force-app')));
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
        assert.ok(err.message.includes('classes/Foo.cls'));
        assert.ok(err.message.includes('12:3'));
        assert.ok(err.message.includes('unexpected token'));
        assert.ok(err.message.includes('classes/Bar.cls'));
        assert.ok(!err.message.includes('classes/Baz.cls'));
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
