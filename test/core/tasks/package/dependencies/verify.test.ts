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
import type { DependencyStep, DriftResult } from '../../../../../src/core/package.dependencies.js';

let resolveDependenciesResult: DependencyStep[] = [];
let computeDriftResult: DriftResult = { missing: [], stale: [], names: new Map() };
let capturedSteps: DependencyStep[] = [];

const verify = await mockTask('package/dependencies/verify.js', {
  'package.dependencies.js': {
    resolveDependencies: async () => resolveDependenciesResult,
    computeDrift: (steps: DependencyStep[]) => {
      capturedSteps = steps;
      return computeDriftResult;
    },
  },
  'sfdx-project.js': {
    readSfdxProject: () => ({ packageDirectories: [] }),
  },
});

beforeEach(() => {
  resolveDependenciesResult = [];
  computeDriftResult = { missing: [], stale: [], names: new Map() };
  capturedSteps = [];
});

describe('package/dependencies/verify', () => {
  it('logs success when in sync', async () => {
    const { logs } = await runTask(verify, {});
    assert.ok(logs[0]?.includes('in sync'));
  });

  it('throws ExpectedError when dependencies are missing from sfdx-project.json', async () => {
    computeDriftResult = { missing: ['04tAAA'], stale: [], names: new Map() };
    await assert.rejects(
      () => runTask(verify, {}),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('04tAAA')
    );
  });

  it('throws ExpectedError when stale entries remain in sfdx-project.json', async () => {
    computeDriftResult = { missing: [], stale: ['04tBBB'], names: new Map() };
    await assert.rejects(
      () => runTask(verify, {}),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('04tBBB')
    );
  });

  it('passes only package-id steps to computeDrift', async () => {
    resolveDependenciesResult = [
      { kind: 'package-id', versionId: '04tAAA' },
      {
        kind: 'metadata',
        versionId: '04tBBB',
        repoUrl: 'https://github.com/org/repo',
        subfolder: 'pre',
        namespace: 'ns',
        tag: 'v1',
      },
    ];
    await runTask(verify, {});
    assert.equal(capturedSteps.length, 1);
    assert.equal(capturedSteps[0]?.kind, 'package-id');
  });

  it('includes the package count in the success log', async () => {
    resolveDependenciesResult = [{ kind: 'package-id', versionId: '04tAAA' }];
    const { logs } = await runTask(verify, {});
    assert.ok(logs[0]?.includes('1 package'));
  });

  it('uses the human-readable name in the error message when available', async () => {
    const names = new Map([['04tAAA', 'My Package']]);
    computeDriftResult = { missing: ['04tAAA'], stale: [], names };
    await assert.rejects(
      () => runTask(verify, {}),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('My Package')
    );
  });
});
