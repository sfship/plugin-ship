import { strict as assert } from 'node:assert';
import { runTask } from '../../run-task.js';
import { mockTask } from '../../mock-task.js';
import { ExpectedError } from '../../../../../src/core/error.js';
import type { PackageVersion } from '../../../../../src/core/package.version.js';

let selectLatestResult: PackageVersion | null = null;

const resolveLatest = await mockTask('package/version/resolve-latest.js', {
  'stdout.js': { withSuppressedStdout: async (fn: () => Promise<unknown>) => fn() },
  'package.version.js': {
    selectLatest: () => selectLatestResult,
    extractVersionBase: (v: string) => v.split('.').slice(0, 3).join('.'),
  },
});

beforeEach(() => {
  selectLatestResult = null;
});

describe('package/version/resolve-latest', () => {
  it('sets version-id, version-number, and version-base outputs', async () => {
    selectLatestResult = {
      SubscriberPackageVersionId: '04tAAA',
      Version: '0.3.0.1',
      IsReleased: false,
      CreatedDate: '2026-06-01',
    };
    const { outputs } = await runTask(resolveLatest, {
      params: { package: 'My Package' },
      runCommand: async () => [],
    });
    assert.equal(outputs['version-id'], '04tAAA');
    assert.equal(outputs['version-number'], '0.3.0.1');
    assert.equal(outputs['version-base'], '0.3.0');
  });

  it('throws ExpectedError when no matching version is found', async () => {
    selectLatestResult = null;
    await assert.rejects(
      () => runTask(resolveLatest, { params: { package: 'My Package' }, runCommand: async () => [] }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('No unreleased versions found')
    );
  });

  it('throws ExpectedError when no package name is available', async () => {
    await assert.rejects(
      () => runTask(resolveLatest, { params: {} }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('No package specified')
    );
  });

  it('logs the resolved version and id', async () => {
    selectLatestResult = {
      SubscriberPackageVersionId: '04tAAA',
      Version: '0.3.0.1',
      IsReleased: false,
      CreatedDate: '2026-06-01',
    };
    const { logs } = await runTask(resolveLatest, {
      params: { package: 'My Package' },
      runCommand: async () => [],
    });
    assert.ok(logs[0]?.includes('04tAAA'));
    assert.ok(logs[0]?.includes('0.3.0.1'));
  });

  it('logs [released] when released=true', async () => {
    selectLatestResult = { SubscriberPackageVersionId: '04tAAA', IsReleased: true, CreatedDate: '2026-06-01' };
    const { logs } = await runTask(resolveLatest, {
      params: { package: 'My Package', released: true },
      runCommand: async () => [],
    });
    assert.ok(logs[0]?.includes('[released]'));
  });

  it('mentions "released" in the error when released=true and no match', async () => {
    await assert.rejects(
      () => runTask(resolveLatest, { params: { package: 'My Package', released: true }, runCommand: async () => [] }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('No released versions found')
    );
  });

  it('passes target-dev-hub to the command', async () => {
    let capturedArgv: string[] = [];
    selectLatestResult = { SubscriberPackageVersionId: '04tAAA', IsReleased: false, CreatedDate: '2026-06-01' };
    await runTask(resolveLatest, {
      params: { package: 'My Package', 'target-dev-hub': 'my-hub' },
      runCommand: async (_id, argv) => {
        capturedArgv = argv;
        return [];
      },
    });
    assert.ok(capturedArgv.includes('--target-dev-hub') && capturedArgv.includes('my-hub'));
  });

  it('passes branch to the command', async () => {
    let capturedArgv: string[] = [];
    selectLatestResult = { SubscriberPackageVersionId: '04tAAA', IsReleased: false, CreatedDate: '2026-06-01' };
    await runTask(resolveLatest, {
      params: { package: 'My Package', branch: 'main' },
      runCommand: async (_id, argv) => {
        capturedArgv = argv;
        return [];
      },
    });
    assert.ok(capturedArgv.includes('--branch') && capturedArgv.includes('main'));
  });

  it('falls back to package name from config', async () => {
    selectLatestResult = { SubscriberPackageVersionId: '04tAAA', IsReleased: false, CreatedDate: '2026-06-01' };
    const { outputs } = await runTask(resolveLatest, {
      params: {},
      runCommand: async () => [],
      context: {
        config: {
          project: { slug: 'test', package: { name: 'Config Package', type: 'Unlocked', testPattern: '**/*Test*' } },
          dir: '.ship',
        },
      },
    });
    assert.equal(outputs['version-id'], '04tAAA');
  });
});
