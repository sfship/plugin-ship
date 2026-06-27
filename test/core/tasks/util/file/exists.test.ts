/*
 * Copyright 2026, Salesforce, Inc.
 *
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
import { runTask } from '../../run-task.js';
import { mockTask } from '../../mock-task.js';
import { ExpectedError } from '../../../../../src/core/error.js';

let pathExistsResult = false;

const exists = await mockTask('util/file/exists.js', {
  'file.js': { pathExists: () => pathExistsResult },
});

beforeEach(() => {
  pathExistsResult = false;
});

describe('util/file/exists', () => {
  it('writes true when the path exists', async () => {
    pathExistsResult = true;
    const { outputs } = await runTask(exists, { params: { path: 'src', kind: 'any' } });
    assert.equal(outputs['exists'], true);
  });

  it('writes false when the path does not exist', async () => {
    pathExistsResult = false;
    const { outputs } = await runTask(exists, { params: { path: 'src', kind: 'any' } });
    assert.equal(outputs['exists'], false);
  });

  it('passes kind=file through to pathExists', async () => {
    pathExistsResult = true;
    const { outputs } = await runTask(exists, { params: { path: 'src', kind: 'file' } });
    assert.equal(outputs['exists'], true);
  });

  it('passes kind=dir through to pathExists', async () => {
    pathExistsResult = true;
    const { outputs } = await runTask(exists, { params: { path: 'src', kind: 'dir' } });
    assert.equal(outputs['exists'], true);
  });

  it('throws ExpectedError for an invalid kind', async () => {
    await assert.rejects(
      () => runTask(exists, { params: { path: 'src', kind: 'symlink' } }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('Invalid kind')
    );
  });
});
