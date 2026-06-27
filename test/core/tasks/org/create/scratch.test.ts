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
import { runTask } from '../../run-task.js';
import { ExpectedError } from '../../../../../src/core/error.js';
import type { Task } from '../../../../../src/core/task.definition.schema.js';
import type { ShipConfig } from '../../../../../src/core/config.ship.schema.js';

type OrgLike = {
  getUsername?: () => string | undefined;
  checkScratchOrg?: (hub: string | undefined) => Promise<void>;
  remove?: () => Promise<void>;
};

let existingOrgBehavior: 'not-found' | 'healthy' | 'expired' = 'not-found';
let removeCalled = false;
let capturedCreate: Record<string, unknown> | undefined;
let scratchCreateResult: { username?: string; warnings: string[] } = { username: 'new@scratch.org', warnings: [] };
let devHubConfigValue: string | undefined = 'default-hub@devhub.org';

const hubOrg: OrgLike = { getUsername: () => 'hub@devhub.org' };
const existingOrg: OrgLike = {
  checkScratchOrg: async () => {
    if (existingOrgBehavior === 'expired') {
      const e = new Error('expired');
      e.name = 'NoResultsError';
      throw e;
    }
  },
  remove: async () => {
    removeCalled = true;
  },
};

const { default: scratchTask }: { default: Pick<Task, 'run'> } = await esmock(
  '../../../../../src/core/tasks/org/create/scratch.js',
  {
    'node:fs': {
      readFileSync: () => JSON.stringify({ edition: 'Developer' }),
    },
    '@salesforce/core': {
      scratchOrgCreate: async (opts: Record<string, unknown>) => {
        capturedCreate = opts;
        return scratchCreateResult;
      },
      Org: {
        create: async ({ aliasOrUsername }: { aliasOrUsername?: string }) => {
          if (aliasOrUsername !== 'my-org') return hubOrg;
          if (existingOrgBehavior === 'not-found') {
            const e = new Error('not found');
            e.name = 'NamedOrgNotFoundError';
            throw e;
          }
          return existingOrg;
        },
      },
      ConfigAggregator: {
        create: async () => ({ getPropertyValue: () => devHubConfigValue }),
      },
      OrgConfigProperties: { TARGET_DEV_HUB: 'target-dev-hub' },
    },
  }
);

beforeEach(() => {
  existingOrgBehavior = 'not-found';
  removeCalled = false;
  capturedCreate = undefined;
  scratchCreateResult = { username: 'new@scratch.org', warnings: [] };
  devHubConfigValue = 'default-hub@devhub.org';
});

const baseParams = { 'scratch-def': 'my-scratch.json', alias: 'my-org', 'dev-hub': 'my-devhub' };

const configWithNamespace = (namespace?: string): ShipConfig => ({
  project: {
    slug: 'test',
    package: { name: 'MyPkg', type: 'Managed', testPattern: '*_Test', namespace },
  },
  dir: '.ship',
});

describe('org/create/scratch', () => {
  it('creates a new org and sets outputs', async () => {
    const { outputs } = await runTask(scratchTask, { params: baseParams });
    assert.equal(outputs['target-org'], 'my-org');
    assert.equal(outputs['created'], true);
  });

  it('skips creation when a healthy org already exists', async () => {
    existingOrgBehavior = 'healthy';
    const { outputs, logs } = await runTask(scratchTask, { params: baseParams });
    assert.equal(outputs['created'], false);
    assert.ok(logs.some((l) => l.includes('already exists')));
    assert.equal(capturedCreate, undefined);
  });

  it('removes and recreates an expired org', async () => {
    existingOrgBehavior = 'expired';
    const { outputs } = await runTask(scratchTask, { params: baseParams });
    assert.ok(removeCalled);
    assert.equal(outputs['created'], true);
  });

  it('injects the namespace from ship config into orgConfig', async () => {
    await runTask(scratchTask, { params: baseParams, context: { config: configWithNamespace('myns') } });
    assert.equal((capturedCreate?.orgConfig as Record<string, unknown>)?.namespace, 'myns');
  });

  it('omits namespace when no-namespace=true', async () => {
    await runTask(scratchTask, {
      params: { ...baseParams, 'no-namespace': true },
      context: { config: configWithNamespace('myns') },
    });
    assert.equal((capturedCreate?.orgConfig as Record<string, unknown>)?.namespace, undefined);
  });

  it('throws ExpectedError when no dev-hub is configured', async () => {
    devHubConfigValue = undefined;
    await assert.rejects(
      () => runTask(scratchTask, { params: { 'scratch-def': 'my-scratch.json', alias: 'my-org' } }),
      (e: unknown) => e instanceof ExpectedError && e.message.includes('No dev hub')
    );
  });

  it('logs warnings from the create result', async () => {
    scratchCreateResult = { username: 'new@scratch.org', warnings: ['Watch out'] };
    const { logs } = await runTask(scratchTask, { params: baseParams });
    assert.ok(logs.some((l) => l.includes('Watch out')));
  });

  it('falls back to ConfigAggregator when no dev-hub param', async () => {
    const { outputs } = await runTask(scratchTask, {
      params: { 'scratch-def': 'my-scratch.json', alias: 'my-org' },
    });
    assert.equal(outputs['created'], true);
  });
});
