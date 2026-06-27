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
import esmock from 'esmock';
import type { installDependencies as InstallFn, describeStep as DescribeFn } from '../../src/core/package.installer.js';
import type { DependencyStep, MetadataStep } from '../../src/core/package.dependencies.js';
import type { ShipDependency } from '../../src/core/config.dependency.schema.js';

type Installer = { installDependencies: typeof InstallFn; describeStep: typeof DescribeFn };
type Installed = { SubscriberPackageVersionId: string };

let stepsResult: DependencyStep[] = [];
let deployedSteps: Array<{ step: MetadataStep; targetOrg: string; shipDir: string }> = [];

const { installDependencies, describeStep }: Installer = await esmock('../../src/core/package.installer.js', {
  '../../src/core/package.dependencies.js': {
    resolveDependencies: async () => stepsResult,
  },
  '../../src/core/stdout.js': {
    withSuppressedStdout: async (fn: () => Promise<unknown>) => fn(),
  },
  '../../src/core/package.metadata.js': {
    deployMetadataStep: async (step: MetadataStep, targetOrg: string, shipDir: string) => {
      deployedSteps.push({ step, targetOrg, shipDir });
    },
  },
});

beforeEach(() => {
  stepsResult = [];
  deployedSteps = [];
});

const pkgStep = (versionId: string, name?: string): DependencyStep => ({ kind: 'package-id', versionId, name });
const metaStep = (versionId: string): MetadataStep => ({
  kind: 'metadata',
  versionId,
  repoUrl: 'https://github.com/org/repo',
  subfolder: 'unpackaged/pre/step1',
  namespace: 'ns',
  tag: 'v1.0.0',
});

type Options = Parameters<typeof installDependencies>[1];

function makeOptions(overrides: Partial<Options> = {}): Options {
  return {
    alias: 'my-org',
    wait: 10,
    dryRun: false,
    force: false,
    shipDir: '/tmp/ship',
    log: () => {},
    runCommand: async (id) => {
      if (id === 'package:installed:list') return [] as Installed[];
      return {};
    },
    ...overrides,
  };
}

const oneDep: ShipDependency[] = [{ versionId: '04tAAA' }];

describe('describeStep', () => {
  it('formats a package-id step with name', () => {
    assert.equal(describeStep(pkgStep('04tAAA', 'My Pkg')), 'package-id  04tAAA (My Pkg)');
  });

  it('formats a package-id step without name', () => {
    assert.equal(describeStep(pkgStep('04tAAA')), 'package-id  04tAAA');
  });

  it('formats a metadata step', () => {
    assert.equal(describeStep(metaStep('04tAAA')), 'metadata    https://github.com/org/repo/unpackaged/pre/step1');
  });
});

describe('installDependencies', () => {
  it('logs and returns early when deps is empty', async () => {
    const logs: string[] = [];
    await installDependencies([], makeOptions({ log: (m) => logs.push(m) }));
    assert.ok(logs[0]?.includes('No dependencies'));
  });

  it('logs and returns early when resolver returns no steps', async () => {
    const logs: string[] = [];
    await installDependencies(oneDep, makeOptions({ log: (m) => logs.push(m) }));
    assert.ok(logs.some((l) => l.includes('zero steps')));
  });

  it('dry-run logs resolved steps and skips install', async () => {
    stepsResult = [pkgStep('04tAAA')];
    const commands: string[] = [];
    const logs: string[] = [];
    await installDependencies(
      oneDep,
      makeOptions({
        dryRun: true,
        log: (m) => logs.push(m),
        runCommand: async (id) => {
          commands.push(id);
          return {};
        },
      })
    );
    assert.ok(logs.some((l) => l.includes('dry-run')));
    assert.ok(!commands.includes('package:install'));
    assert.ok(!commands.includes('package:installed:list'));
  });

  it('installs a package-id step with correct args', async () => {
    stepsResult = [pkgStep('04tAAA')];
    const commands: Array<{ id: string; argv: string[] }> = [];
    await installDependencies(
      oneDep,
      makeOptions({
        runCommand: async (id, argv) => {
          commands.push({ id, argv });
          if (id === 'package:installed:list') return [] as Installed[];
          return {};
        },
      })
    );
    const install = commands.find((c) => c.id === 'package:install');
    assert.ok(install, 'package:install was not called');
    assert.ok(install.argv.includes('04tAAA'));
    assert.ok(install.argv.includes('my-org'));
    assert.ok(install.argv.includes('--wait'));
    assert.ok(install.argv.includes('10'));
  });

  it('skips already-installed package-id steps', async () => {
    stepsResult = [pkgStep('04tAAA')];
    const commands: string[] = [];
    await installDependencies(
      oneDep,
      makeOptions({
        runCommand: async (id) => {
          commands.push(id);
          if (id === 'package:installed:list') return [{ SubscriberPackageVersionId: '04tAAA' }] as Installed[];
          return {};
        },
      })
    );
    assert.ok(!commands.includes('package:install'));
  });

  it('force=true skips installed list and installs anyway', async () => {
    stepsResult = [pkgStep('04tAAA')];
    const commands: string[] = [];
    await installDependencies(
      oneDep,
      makeOptions({
        force: true,
        runCommand: async (id) => {
          commands.push(id);
          return {};
        },
      })
    );
    assert.ok(!commands.includes('package:installed:list'));
    assert.ok(commands.includes('package:install'));
  });

  it('deploys metadata steps with the right org and shipDir', async () => {
    stepsResult = [metaStep('04tAAA')];
    await installDependencies(oneDep, makeOptions());
    assert.equal(deployedSteps.length, 1);
    assert.equal(deployedSteps[0]?.targetOrg, 'my-org');
    assert.equal(deployedSteps[0]?.shipDir, '/tmp/ship');
  });

  it('skips already-installed metadata steps', async () => {
    stepsResult = [metaStep('04tAAA')];
    await installDependencies(
      oneDep,
      makeOptions({
        runCommand: async (id) => {
          if (id === 'package:installed:list') return [{ SubscriberPackageVersionId: '04tAAA' }] as Installed[];
          return {};
        },
      })
    );
    assert.equal(deployedSteps.length, 0);
  });

  it('omits --target-org from package:install when alias is undefined', async () => {
    stepsResult = [pkgStep('04tAAA')];
    const commands: Array<{ id: string; argv: string[] }> = [];
    await installDependencies(
      oneDep,
      makeOptions({
        alias: undefined,
        runCommand: async (id, argv) => {
          commands.push({ id, argv });
          if (id === 'package:installed:list') return [] as Installed[];
          return {};
        },
      })
    );
    const install = commands.find((c) => c.id === 'package:install');
    assert.ok(install);
    assert.ok(!install.argv.includes('--target-org'));
  });

  it('logs installed count with alias label', async () => {
    stepsResult = [pkgStep('04tAAA')];
    const logs: string[] = [];
    await installDependencies(
      oneDep,
      makeOptions({
        log: (m) => logs.push(m),
        runCommand: async (id) => {
          if (id === 'package:installed:list') return [{ SubscriberPackageVersionId: '04tBBB' }] as Installed[];
          return {};
        },
      })
    );
    assert.ok(logs.some((l) => l.includes('1') && l.includes('my-org')));
  });
});
