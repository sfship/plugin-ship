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

let findFilesResult: string[] = [];

const find = await mockTask('util/file/find.js', {
  'file.js': { findFiles: async () => findFilesResult },
});

beforeEach(() => {
  findFilesResult = [];
});

describe('util/file/find', () => {
  it('writes matching file names and count to outputs', async () => {
    findFilesResult = ['deploy', 'build'];
    const { outputs } = await runTask(find, { params: { path: 'src' } });
    assert.equal(outputs['files'], 'deploy,build');
    assert.equal(outputs['count'], '2');
  });

  it('writes empty files and zero count when nothing matches', async () => {
    findFilesResult = [];
    const { outputs } = await runTask(find, { params: { path: 'src' } });
    assert.equal(outputs['files'], '');
    assert.equal(outputs['count'], '0');
  });
});
