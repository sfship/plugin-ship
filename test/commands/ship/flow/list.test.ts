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
import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { mockCommand } from '../../mock-command.js';

let flowNames: string[] = [];

const FlowList = await mockCommand('ship/flow/list.js', {
  'config.loader.js': {
    loadConfig: () => ({}),
    resolveProjectPaths: () => ({ shipDir: '/proj/.ship' }),
  },
  'flow.registry.js': {
    FlowRegistry: class {
      public list() {
        return flowNames;
      }
    },
  },
  'tree.js': {
    renderTree: (names: string[]) => names.join('\n'),
  },
});

describe('ship flow list', () => {
  const $$ = new TestContext();
  let stubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(() => {
    stubs = stubSfCommandUx($$.SANDBOX);
    flowNames = [];
  });

  it('shows the Flow List header', async () => {
    await FlowList.run([]);
    assert.ok(stubs.styledHeader.calledWith('Flow List'));
  });

  it('logs "No flows available." when the registry is empty', async () => {
    await FlowList.run([]);
    assert.ok(stubs.log.args.some(([a]) => String(a ?? '').includes('No flows available.')));
  });

  it('renders flow names via renderTree when flows exist', async () => {
    flowNames = ['deploy', 'release'];
    await FlowList.run([]);
    assert.ok(stubs.log.args.some(([a]) => String(a ?? '').includes('deploy')));
    assert.ok(stubs.log.args.some(([a]) => String(a ?? '').includes('release')));
  });

  it('logs the info tip when flows exist', async () => {
    flowNames = ['deploy'];
    await FlowList.run([]);
    assert.ok(stubs.log.args.some(([a]) => String(a ?? '').includes('sf ship flow info')));
  });
});
