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
import { runTask } from '../run-task.js';
import { mockTask } from '../mock-task.js';
import { ExpectedError } from '../../../../src/core/error.js';

let aliases: Record<string, string> = {};
let capturedWrite: { projectDir: string; aliases: Record<string, string> } | undefined;

const create = await mockTask('package/create.js', {
  'sfdx-project.js': {
    readSfdxProject: () => ({ packageDirectories: [], packageAliases: aliases }),
    writeSfdxProject: (projectDir: string, project: { packageAliases?: Record<string, string> }) => {
      capturedWrite = { projectDir, aliases: project.packageAliases ?? {} };
    },
  },
});

beforeEach(() => {
  aliases = {};
  capturedWrite = undefined;
});

describe('package/create', () => {
  it('skips creation and sets output when the package is already registered', async () => {
    aliases = { 'My Package': '0HoEXISTING' };
    const { outputs, logs } = await runTask(create, { params: { name: 'My Package', 'package-type': 'Managed' } });
    assert.equal(outputs['package-id'], '0HoEXISTING');
    assert.ok(logs[0]?.includes('already registered'));
    assert.equal(capturedWrite, undefined);
  });

  it('creates the package and writes the alias to sfdx-project.json', async () => {
    const { outputs } = await runTask(create, {
      params: { name: 'My Package', 'package-type': 'Managed' },
      runCommand: async () => ({ Id: '0HoNEW' }),
    });
    assert.equal(outputs['package-id'], '0HoNEW');
    assert.equal(capturedWrite?.aliases['My Package'], '0HoNEW');
  });

  it('throws ExpectedError when no package name is available', async () => {
    await assert.rejects(
      () => runTask(create, { params: { 'package-type': 'Managed' } }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('No package name')
    );
  });

  it('throws ExpectedError when the command returns no Id', async () => {
    await assert.rejects(
      () =>
        runTask(create, {
          params: { name: 'My Package', 'package-type': 'Managed' },
          runCommand: async () => ({}),
        }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('Package create completed without')
    );
  });

  it('logs the created package id', async () => {
    const { logs } = await runTask(create, {
      params: { name: 'My Package', 'package-type': 'Managed' },
      runCommand: async () => ({ Id: '0HoNEW' }),
    });
    assert.ok(logs.some((l) => l.includes('0HoNEW')));
  });
});
