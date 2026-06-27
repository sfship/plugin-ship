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
import type { PackageIdStep } from '../../../../../src/core/package.dependencies.js';
import type { SfdxProject, PackageDirectory } from '../../../../../src/core/sfdx-project.js';

let stepsResult: PackageIdStep[] = [];
let capturedWrite: SfdxProject | undefined;
let baseProject: SfdxProject = { packageDirectories: [{ path: 'force-app', default: true, package: 'MyPkg' }] };

const lock = await mockTask('package/dependencies/lock.js', {
  'package.dependencies.js': {
    resolveDependencies: async () => stepsResult,
  },
  'sfdx-project.js': {
    readSfdxProject: (): SfdxProject => baseProject,
    writeSfdxProject: (_: string, p: SfdxProject) => {
      capturedWrite = p;
    },
    defaultPackageDirectory: (p: SfdxProject): PackageDirectory | undefined => p.packageDirectories?.[0],
  },
});

beforeEach(() => {
  stepsResult = [];
  capturedWrite = undefined;
  baseProject = { packageDirectories: [{ path: 'force-app', default: true, package: 'MyPkg' }] };
});

describe('package/dependencies/lock', () => {
  it('writes named deps as packageAliases and references them by name', async () => {
    stepsResult = [{ kind: 'package-id', versionId: '04tAAA', name: 'My Package' }];
    await runTask(lock, {});
    assert.equal(capturedWrite?.packageAliases?.['My Package'], '04tAAA');
    const deps = capturedWrite?.packageDirectories?.[0]?.dependencies;
    assert.deepEqual(deps, [{ package: 'My Package' }]);
  });

  it('falls back to raw 04t for unnamed steps', async () => {
    stepsResult = [{ kind: 'package-id', versionId: '04tAAA' }];
    await runTask(lock, {});
    const deps = capturedWrite?.packageDirectories?.[0]?.dependencies;
    assert.deepEqual(deps, [{ package: '04tAAA' }]);
  });

  it('clears dependencies when steps is empty', async () => {
    baseProject = {
      packageDirectories: [
        { path: 'force-app', default: true, package: 'MyPkg', dependencies: [{ package: '04tOLD' }] },
      ],
    };
    await runTask(lock, {});
    assert.equal('dependencies' in (capturedWrite?.packageDirectories?.[0] ?? {}), false);
  });

  it('throws ExpectedError when the default packageDirectory has no package', async () => {
    baseProject = { packageDirectories: [{ path: 'force-app', default: true }] };
    await assert.rejects(
      () => runTask(lock, {}),
      (e: unknown) => e instanceof ExpectedError
    );
  });

  it('logs the count written', async () => {
    stepsResult = [
      { kind: 'package-id', versionId: '04tAAA', name: 'Pkg A' },
      { kind: 'package-id', versionId: '04tBBB', name: 'Pkg B' },
    ];
    const { logs } = await runTask(lock, {});
    assert.ok(logs[0]?.includes('2'));
  });

  it('logs cleared when no deps remain', async () => {
    const { logs } = await runTask(lock, {});
    assert.ok(logs[0]?.includes('cleared'));
  });
});
