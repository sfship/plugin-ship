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
});
