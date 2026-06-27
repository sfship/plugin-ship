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
import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { Config } from '@oclif/core';
import type { SinonStub } from 'sinon';
import { mockCommand } from '../../mock-command.js';
import type { InitResult } from '../../../../src/core/project.init.js';

let inputCallCount = 0;
let inputResponses: string[] = [];
let initResult: InitResult = { created: [], skipped: [] };
let initArgs: unknown[] | undefined;

const ProjectInit = await mockCommand('ship/project/init.js', {
  '@inquirer/prompts': {
    input: async () => inputResponses[inputCallCount++] ?? '',
    select: async () => 'Managed',
  },
  'project.init.js': {
    initProject: (...args: unknown[]) => {
      initArgs = args;
      return initResult;
    },
  },
});

describe('ship project init', () => {
  const $$ = new TestContext();
  let stubs: ReturnType<typeof stubSfCommandUx>;
  let runCommandStub: SinonStub;

  beforeEach(() => {
    stubs = stubSfCommandUx($$.SANDBOX);
    runCommandStub = $$.SANDBOX.stub(Config.prototype, 'runCommand').resolves();
    inputCallCount = 0;
    inputResponses = ['My Package', 'mypkg', 'https://github.com/acme/repo'];
    initResult = { created: [], skipped: [] };
    initArgs = undefined;
  });

  it('shows the Project Initialized! header', async () => {
    await ProjectInit.run([]);
    assert.ok(stubs.styledHeader.calledWith('Project Initialized!'));
  });

  it('runs project:generate with --name, --template, and --output-dir', async () => {
    await ProjectInit.run([]);
    const [cmd, args] = runCommandStub.firstCall.args as [string, string[]];
    assert.equal(cmd, 'project:generate');
    assert.ok(args.includes('--name'), '--name present');
    assert.ok(args.includes('--template'), '--template present');
    assert.ok(args.includes('--output-dir'), '--output-dir present');
  });

  it('passes --api-version to project:generate when provided', async () => {
    await ProjectInit.run(['--api-version', '59.0']);
    const [, args] = runCommandStub.firstCall.args as [string, string[]];
    const idx = args.indexOf('--api-version');
    assert.ok(idx !== -1, '--api-version present');
    assert.equal(args[idx + 1], '59.0');
  });

  it('passes --lwc-language to project:generate when provided', async () => {
    await ProjectInit.run(['--lwc-language', 'ts']);
    const [, args] = runCommandStub.firstCall.args as [string, string[]];
    const idx = args.indexOf('--lwc-language');
    assert.ok(idx !== -1, '--lwc-language present');
    assert.equal(args[idx + 1], 'ts');
  });

  it('passes prompt answers to initProject', async () => {
    await ProjectInit.run([]);
    assert.ok(initArgs);
    const [opts] = initArgs as [{ packageName: string; namespace: string; packageType: string; repoUrl: string }];
    assert.equal(opts.packageName, 'My Package');
    assert.equal(opts.namespace, 'mypkg');
    assert.equal(opts.packageType, 'Managed');
    assert.equal(opts.repoUrl, 'https://github.com/acme/repo');
  });

  it('logs created files', async () => {
    initResult = { created: ['ship.yml', '.ship/orgs/dev.json'], skipped: [] };
    await ProjectInit.run([]);
    assert.ok(stubs.log.args.some(([a]) => String(a ?? '').includes('created  ship.yml')));
    assert.ok(stubs.log.args.some(([a]) => String(a ?? '').includes('created  .ship/orgs/dev.json')));
  });

  it('logs skipped files with README special message', async () => {
    initResult = { created: [], skipped: ['README.md', 'ship.yml'] };
    await ProjectInit.run([]);
    assert.ok(stubs.log.args.some(([a]) => String(a ?? '').includes('your project already has one')));
    assert.ok(stubs.log.args.some(([a]) => String(a ?? '').includes('skipped  ship.yml (already exists)')));
  });
});
