import { strict as assert } from 'node:assert';
import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { mockCommand } from '../../mock-command.js';
import type { ServiceMeta } from '../../../../src/core/service.js';

let metaResult: ServiceMeta | undefined;
let deleteTokenArgs: [string, string, string] | undefined;

const ServiceDelete = await mockCommand('ship/service/delete.js', {
  'service.js': {
    getMeta: () => metaResult,
    deleteToken: (service: string, account: string, alias: string) => {
      deleteTokenArgs = [service, account, alias];
    },
  },
});

describe('ship service delete', () => {
  const $$ = new TestContext();
  let stubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(() => {
    stubs = stubSfCommandUx($$.SANDBOX);
    metaResult = undefined;
    deleteTokenArgs = undefined;
  });

  it('shows the Service Delete header', async () => {
    metaResult = { service: 'github', account: 'acme', alias: 'default', scopes: [] };
    await ServiceDelete.run(['github', 'default']);
    assert.ok(stubs.styledHeader.calledWith('Service Delete'));
  });

  it('errors when no credential is found', async () => {
    await assert.rejects(
      () => ServiceDelete.run(['github', 'default']),
      (err: unknown) => err instanceof Error && err.message.includes('No credential found for "github"')
    );
  });

  it('deletes the token with the correct args', async () => {
    metaResult = { service: 'github', account: 'acme', alias: 'default', scopes: [] };
    await ServiceDelete.run(['github', 'default']);
    assert.deepEqual(deleteTokenArgs, ['github', 'acme', 'default']);
  });

  it('logs a success message after deletion', async () => {
    metaResult = { service: 'github', account: 'acme', alias: 'default', scopes: [] };
    await ServiceDelete.run(['github', 'default']);
    const success = stubs.log.args.find(([a]) => String(a ?? '').includes('Removed github credential'));
    assert.ok(success, 'expected a log call with the success message');
  });
});
