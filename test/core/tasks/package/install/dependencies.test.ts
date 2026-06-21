import { strict as assert } from 'node:assert';
import { runTask } from '../../run-task.js';
import { mockTask } from '../../mock-task.js';
import type { ShipConfig } from '../../../../../src/core/config.ship.schema.js';

type CapturedCall = {
  deps: unknown[];
  options: {
    wait: number;
    dryRun: boolean;
    force: boolean;
    alias: string | undefined;
    shipDir: string;
  };
};

let capturedCall: CapturedCall | undefined;

const dependencies = await mockTask('package/install/dependencies.js', {
  'package.installer.js': {
    installDependencies: async (deps: unknown[], options: CapturedCall['options']) => {
      capturedCall = { deps, options };
    },
  },
});

beforeEach(() => {
  capturedCall = undefined;
});

const configWithDeps: ShipConfig = {
  project: {
    slug: 'test',
    package: {
      name: 'MyPkg',
      type: 'Managed',
      testPattern: '*_Test',
      dependencies: [{ versionId: '04tAAA' }],
    },
  },
  dir: '.ship',
};

describe('package/install/dependencies', () => {
  it('passes deps from config to installDependencies', async () => {
    await runTask(dependencies, { context: { config: configWithDeps } });
    assert.ok(capturedCall);
    assert.equal(capturedCall.deps.length, 1);
  });

  it('passes empty deps when config has no package', async () => {
    await runTask(dependencies, {});
    assert.ok(capturedCall);
    assert.deepEqual(capturedCall.deps, []);
  });

  it('maps the wait param', async () => {
    await runTask(dependencies, { params: { wait: 30 } });
    assert.ok(capturedCall);
    assert.equal(capturedCall.options.wait, 30);
  });

  it('defaults wait to 10 when omitted', async () => {
    await runTask(dependencies, {});
    assert.ok(capturedCall);
    assert.equal(capturedCall.options.wait, 10);
  });

  it('maps dry-run and force params', async () => {
    await runTask(dependencies, { params: { 'dry-run': true, force: true } });
    assert.ok(capturedCall);
    assert.equal(capturedCall.options.dryRun, true);
    assert.equal(capturedCall.options.force, true);
  });
});
