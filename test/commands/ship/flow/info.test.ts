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
/* eslint-disable class-methods-use-this */

import { strict as assert } from 'node:assert';
import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx, stubUx } from '@salesforce/sf-plugins-core';
import { mockCommand } from '../../mock-command.js';

let flowResult: Record<string, unknown> | undefined;

const FlowInfo = await mockCommand('ship/flow/info.js', {
  'config.loader.js': {
    loadConfig: () => ({}),
    resolveProjectPaths: () => ({ shipDir: '/proj/.ship' }),
  },
  'flow.registry.js': {
    FlowRegistry: class {
      public resolveFlow() {
        if (!flowResult) throw new Error('Flow not found');
        return flowResult;
      }
    },
  },
  'error.js': {
    asError: (err: unknown) => (err instanceof Error ? err : new Error(String(err))),
  },
  'flow.view.js': {
    formatFlowPreview: (name: string) => `=== ${name} ===`,
  },
});

const baseFlow = {
  description: 'Deploys to an org',
  params: [],
  steps: { 'deploy-metadata': { task: 'sf/deploy', params: { org: 'dev' } } },
};

describe('ship flow info', () => {
  const $$ = new TestContext();
  let stubs: ReturnType<typeof stubSfCommandUx>;
  let uxStubs: ReturnType<typeof stubUx>;

  beforeEach(() => {
    stubs = stubSfCommandUx($$.SANDBOX);
    uxStubs = stubUx($$.SANDBOX);
    flowResult = undefined;
  });

  it('shows the Flow Info header', async () => {
    flowResult = baseFlow;
    await FlowInfo.run(['deploy']);
    assert.ok(stubs.styledHeader.calledWith('Flow Info'));
  });

  it('errors when the flow is not found', async () => {
    await assert.rejects(
      () => FlowInfo.run(['unknown']),
      (err: unknown) => err instanceof Error && err.message.includes('Flow not found')
    );
  });

  it('logs the flow preview', async () => {
    flowResult = baseFlow;
    await FlowInfo.run(['deploy']);
    assert.ok(stubs.log.args.some(([a]) => String(a ?? '').includes('=== deploy ===')));
  });

  it('shows the Params section when params are present', async () => {
    flowResult = {
      ...baseFlow,
      params: [{ name: 'env', type: 'string', required: true, description: 'Target env' }],
    };
    await FlowInfo.run(['deploy']);
    assert.ok(stubs.styledHeader.calledWith('Params'));
    const tableData = uxStubs.table.args.find(([{ data }]) =>
      (data as Array<{ name: string }>).some((r) => r.name === 'env')
    );
    assert.ok(tableData, 'params table rendered');
  });

  it('omits the Params section when params are empty', async () => {
    flowResult = baseFlow;
    await FlowInfo.run(['deploy']);
    assert.ok(!stubs.styledHeader.calledWith('Params'));
  });

  it('shows the Flow Steps section', async () => {
    flowResult = baseFlow;
    await FlowInfo.run(['deploy']);
    assert.ok(stubs.styledHeader.calledWith('Flow Steps'));
    const tableData = uxStubs.table.args.find(([{ data }]) =>
      (data as Array<{ id: string }>).some((r) => r.id === 'deploy-metadata')
    );
    assert.ok(tableData, 'steps table rendered');
  });

  it('includes required params in the tip', async () => {
    flowResult = {
      ...baseFlow,
      params: [{ name: 'env', type: 'string', required: true }],
    };
    await FlowInfo.run(['deploy']);
    const tip = stubs.log.args.find(([a]) => String(a ?? '').includes('sf ship flow run'));
    assert.ok(tip, 'tip logged');
    assert.ok(String(tip[0]).includes('--param env='));
  });
});
