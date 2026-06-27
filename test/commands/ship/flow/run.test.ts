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
/* eslint-disable class-methods-use-this */

import { strict as assert } from 'node:assert';
import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import type { SinonStub } from 'sinon';
import { mockCommand } from '../../mock-command.js';

class MockExpectedError extends Error {}

let runFlowCalled = false;
let runFlowShouldThrow: Error | undefined;
let resolveFlowShouldThrow = false;

const FlowRun = await mockCommand('ship/flow/run.js', {
  'config.loader.js': {
    loadConfig: () => ({ project: { slug: 'test' } }),
    resolveProjectPaths: () => ({ projectDir: '/proj', shipDir: '/proj/.ship' }),
  },
  'flow.registry.js': {
    FlowRegistry: class {
      public resolveFlow() {
        if (resolveFlowShouldThrow) throw new Error('Flow "unknown" not found');
        return { name: 'deploy', steps: [] };
      }
    },
  },
  'flow.context.js': {
    createFlowContext: () => ({}),
  },
  'task.param.js': {
    parseCliParams: () => ({}),
  },
  'error.js': {
    asError: (err: unknown) => (err instanceof Error ? err : new Error(String(err))),
    ExpectedError: MockExpectedError,
  },
  'flow.runner.js': {
    runFlow: async () => {
      runFlowCalled = true;
      if (runFlowShouldThrow) throw runFlowShouldThrow;
    },
  },
  'org.registry.js': {
    OrgRegistry: class {},
  },
});

describe('ship flow run', () => {
  const $$ = new TestContext();
  let stubs: ReturnType<typeof stubSfCommandUx>;
  let exitStub: SinonStub;

  beforeEach(() => {
    stubs = stubSfCommandUx($$.SANDBOX);
    exitStub = $$.SANDBOX.stub(process, 'exit');
    runFlowCalled = false;
    runFlowShouldThrow = undefined;
    resolveFlowShouldThrow = false;
  });

  it('shows the Flow Run header', async () => {
    await FlowRun.run(['deploy']);
    assert.ok(stubs.styledHeader.calledWith('Flow Run'));
  });

  it('runs the resolved flow', async () => {
    await FlowRun.run(['deploy']);
    assert.ok(runFlowCalled);
  });

  it('errors when the flow is not found', async () => {
    resolveFlowShouldThrow = true;
    await assert.rejects(
      () => FlowRun.run(['unknown']),
      (err: unknown) => err instanceof Error && err.message.includes('unknown')
    );
  });

  it('calls process.exit(1) when runFlow throws an ExpectedError', async () => {
    runFlowShouldThrow = new MockExpectedError('flow failed');
    await FlowRun.run(['deploy']);
    assert.ok(exitStub.calledWith(1));
  });

  it('re-throws non-ExpectedError failures from runFlow', async () => {
    runFlowShouldThrow = new Error('unexpected failure');
    await assert.rejects(
      () => FlowRun.run(['deploy']),
      (err: unknown) => err instanceof Error && err.message === 'unexpected failure'
    );
  });
});
