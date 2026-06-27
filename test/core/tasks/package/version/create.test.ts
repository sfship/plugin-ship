import { strict as assert } from 'node:assert';
import { runTask } from '../../run-task.js';
import { mockTask } from '../../mock-task.js';
import { ExpectedError } from '../../../../../src/core/error.js';

let defaultAliasResult: string | null = null;
let formatVersionNumberResult: string | undefined = '1.2.3.4';

const create = await mockTask('package/version/create.js', {
  'sfdx-project.js': { defaultPackageAlias: () => defaultAliasResult },
  'package.version.js': { formatVersionNumber: () => formatVersionNumberResult },
});

beforeEach(() => {
  defaultAliasResult = null;
  formatVersionNumberResult = '1.2.3.4';
});

const baseResult = {
  SubscriberPackageVersionId: '04tAAA',
  Package2VersionId: '05iAAA',
  Status: 'Success',
};

describe('package/version/create', () => {
  it('sets version-id, package-version-id, and version-number outputs', async () => {
    const { outputs } = await runTask(create, {
      params: { package: 'MyPkg' },
      runCommand: async () => baseResult,
    });
    assert.equal(outputs['version-id'], '04tAAA');
    assert.equal(outputs['package-version-id'], '05iAAA');
    assert.equal(outputs['version-number'], '1.2.3.4');
  });

  it('omits package-version-id and version-number when absent from the result', async () => {
    formatVersionNumberResult = undefined;
    const { outputs } = await runTask(create, {
      params: { package: 'MyPkg' },
      runCommand: async () => ({ SubscriberPackageVersionId: '04tAAA', Status: 'Success' }),
    });
    assert.equal(outputs['version-id'], '04tAAA');
    assert.equal('package-version-id' in outputs, false);
    assert.equal('version-number' in outputs, false);
  });

  it('throws ExpectedError when the result has no SubscriberPackageVersionId', async () => {
    await assert.rejects(
      () => runTask(create, { params: { package: 'MyPkg' }, runCommand: async () => ({ Status: 'Error' }) }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('without a SubscriberPackageVersionId')
    );
  });

  it('falls back to defaultPackageAlias when no package or path param is given', async () => {
    defaultAliasResult = 'DefaultPkg';
    let capturedArgv: string[] = [];
    await runTask(create, {
      params: {},
      runCommand: async (_id, argv) => {
        capturedArgv = argv;
        return baseResult;
      },
    });
    assert.ok(capturedArgv.includes('DefaultPkg'));
  });

  it('logs the created version id', async () => {
    const { logs } = await runTask(create, {
      params: { package: 'MyPkg' },
      runCommand: async () => baseResult,
    });
    assert.ok(logs.some((l) => l.includes('04tAAA')));
  });

  it('uses "(default package)" as label when no package, path, or alias is available', async () => {
    const { logs } = await runTask(create, {
      params: {},
      runCommand: async () => baseResult,
    });
    assert.ok(logs[0]?.includes('(default package)'));
  });

  it('falls back to "unknown" status in the error message when Status is absent', async () => {
    await assert.rejects(
      () => runTask(create, { params: { package: 'MyPkg' }, runCommand: async () => ({}) }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('unknown')
    );
  });

  it('falls back to "Success" in the log when Status is absent from the result', async () => {
    const { logs } = await runTask(create, {
      params: { package: 'MyPkg' },
      runCommand: async () => ({ SubscriberPackageVersionId: '04tAAA' }),
    });
    assert.ok(logs.some((l) => l.includes('Success')));
  });
});
