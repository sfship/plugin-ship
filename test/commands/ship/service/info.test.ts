/*
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
import { stubSfCommandUx, stubUx } from '@salesforce/sf-plugins-core';
import { mockCommand } from '../../mock-command.js';
import type { ServiceMeta } from '../../../../src/core/service.js';

let metaResult: ServiceMeta | undefined;

const ServiceInfo = await mockCommand('ship/service/info.js', {
  'service.js': {
    getMeta: () => metaResult,
  },
});

describe('ship service info', () => {
  const $$ = new TestContext();
  let stubs: ReturnType<typeof stubSfCommandUx>;
  let uxStubs: ReturnType<typeof stubUx>;

  beforeEach(() => {
    stubs = stubSfCommandUx($$.SANDBOX);
    uxStubs = stubUx($$.SANDBOX);
    metaResult = undefined;
  });

  it('shows the Service Info header', async () => {
    metaResult = { service: 'github', account: 'acme', alias: 'default', scopes: ['repo'] };
    await ServiceInfo.run(['github', 'default']);
    assert.ok(stubs.styledHeader.calledWith('Service Info'));
  });

  it('errors when no credential is found', async () => {
    await assert.rejects(
      () => ServiceInfo.run(['github', 'default']),
      (err: unknown) => err instanceof Error && err.message.includes('No credential found for "github"')
    );
  });

  it('renders the credential table when meta is found', async () => {
    metaResult = { service: 'github', account: 'acme', alias: 'default', scopes: ['repo'] };
    await ServiceInfo.run(['github', 'default']);
    assert.ok(uxStubs.table.calledOnce);
  });

  it('renders an em-dash for scopes when none are granted', async () => {
    metaResult = { service: 'github', account: 'acme', alias: 'default', scopes: [] };
    await ServiceInfo.run(['github', 'default']);
    const tableData = uxStubs.table.firstCall.args[0].data as Array<{ field: string; value: string }>;
    const scopesRow = tableData.find((r) => r.field === 'Scopes');
    assert.equal(scopesRow?.value, '—');
  });
});
